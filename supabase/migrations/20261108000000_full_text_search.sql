-- Búsqueda de publicaciones y comentarios (ver docs/busqueda.md). Se busca
-- contenido, nunca apodos. Dos mecanismos de Postgres, sin servicios aparte:
--
-- 1. Full-text search (lo principal): en español, por raíces ("homologando"
--    encuentra "homologar") y sin importar tildes. La última palabra cuenta
--    como prefijo, para encontrar mientras se escribe ("cafete" encuentra
--    "cafetería").
-- 2. pg_trgm (respaldo): parecido por trigramas, para errores de tipeo
--    ("cafetria" encuentra "cafetería"). Lo que encuentra el full-text
--    siempre va antes que lo que encuentra por parecido.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent() no es IMMUTABLE (depende de un diccionario configurable), y
-- una columna generada o un índice solo aceptan funciones IMMUTABLE. Este
-- envoltorio fija el diccionario, que es lo que la vuelve inmutable.
create function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1);
$$;

-- El título pesa más que el cuerpo al ordenar por relevancia.
alter table posts add column search_vector tsvector generated always as (
  setweight(to_tsvector('spanish', public.immutable_unaccent(title)), 'A') ||
  setweight(to_tsvector('spanish', public.immutable_unaccent(body)), 'B')
) stored;

alter table comments add column search_vector tsvector generated always as (
  to_tsvector('spanish', public.immutable_unaccent(body))
) stored;

create index posts_search_vector_idx on posts using gin (search_vector);
create index comments_search_vector_idx on comments using gin (search_vector);

-- Texto plano (sin tildes, en minúsculas) para comparar por trigramas.
alter table posts add column search_text text generated always as (
  lower(public.immutable_unaccent(title || ' ' || body))
) stored;

alter table comments add column search_text text generated always as (
  lower(public.immutable_unaccent(body))
) stored;

create index posts_search_text_trgm_idx on posts using gin (search_text extensions.gin_trgm_ops);
create index comments_search_text_trgm_idx
  on comments using gin (search_text extensions.gin_trgm_ops);

-- Publicaciones y comentarios de un panel que coinciden con la búsqueda, en
-- una sola lista (como el diseño): cada fila trae lo que la app necesita
-- para mostrarla, autor y universidad incluidos. Los comentarios borrados no
-- aparecen (su texto sigue en la base, pero el autor lo borró).
--
-- Coincide si:
--   - el full-text encuentra todas las palabras (la última como prefijo), o
--   - la búsqueda se parece lo suficiente a alguna parte del texto
--     (word_similarity ≥ 0.55; solo con 4 letras o más, porque con menos casi
--     todo "se parece").
--
-- p_sort: 'relevance' o 'new'. En relevancia, lo que encontró el full-text
-- (rank ≥ 1, ordenado por ts_rank) va siempre antes que lo encontrado solo
-- por parecido (rank < 1); a igual rank, lo más nuevo.
--
-- Paginado por offset: un ranking por relevancia no tiene un orden estable
-- para usar como cursor, y las búsquedas no van tan profundo.
create function public.search_content(
  p_query text,
  p_panel_id uuid,
  p_sort text,
  p_limit integer,
  p_offset integer
)
returns table (
  kind text,
  id uuid,
  post_id uuid,
  post_title text,
  community_id uuid,
  title text,
  body text,
  score integer,
  comment_count integer,
  created_at timestamptz,
  author_id uuid,
  author_username text,
  university_id uuid,
  university_slug text,
  university_name text,
  rank real
)
language sql
stable
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.55
as $$
  with words as (
    -- Palabras de la búsqueda, sin tildes ni símbolos (así no hay forma de
    -- armar un tsquery inválido).
    select
      lower(public.immutable_unaccent(p_query)) as plain,
      array_remove(
        regexp_split_to_array(lower(public.immutable_unaccent(p_query)), '[^a-z0-9]+'),
        ''
      ) as list
  ),
  q as (
    -- Todas las palabras menos la última, completas; la última, como prefijo
    -- ("cafete:*"). Un tsquery vacío (ej. solo "de") no encuentra nada por
    -- full-text, y queda el parecido.
    select
      plain,
      plainto_tsquery('spanish', array_to_string(list[1:cardinality(list) - 1], ' '))
        && coalesce(
          to_tsquery('spanish', list[cardinality(list)] || ':*'),
          ''::tsquery
        ) as query,
      length(plain) >= 4 as fuzzy
    from words
    where cardinality(list) > 0
  ),
  hits as (
    select
      'post'::text as kind, p.id, p.id as post_id, p.title as post_title, p.community_id,
      p.title, p.body, p.score, p.comment_count, p.created_at, p.author_id,
      case
        when p.search_vector @@ q.query then 1 + ts_rank(p.search_vector, q.query)
        else extensions.word_similarity(q.plain, p.search_text)
      end as rank
    from public.posts p
    join public.communities c on c.id = p.community_id
    cross join q
    where c.panel_id = p_panel_id
      and (
        p.search_vector @@ q.query
        or (q.fuzzy and q.plain operator(extensions.<%) p.search_text)
      )

    union all

    select
      'comment'::text, cm.id, p.id, p.title, p.community_id,
      null, cm.body, cm.score, null, cm.created_at, cm.author_id,
      case
        when cm.search_vector @@ q.query then 1 + ts_rank(cm.search_vector, q.query)
        else extensions.word_similarity(q.plain, cm.search_text)
      end
    from public.comments cm
    join public.posts p on p.id = cm.post_id
    join public.communities c on c.id = p.community_id
    cross join q
    where c.panel_id = p_panel_id
      and cm.deleted_at is null
      and (
        cm.search_vector @@ q.query
        or (q.fuzzy and q.plain operator(extensions.<%) cm.search_text)
      )
  )
  select
    h.kind, h.id, h.post_id, h.post_title, h.community_id, h.title, h.body, h.score,
    h.comment_count, h.created_at, h.author_id, pr.username, u.id, u.slug, u.name, h.rank
  from hits h
  join public.profiles pr on pr.id = h.author_id
  join public.universities u on u.id = pr.university_id
  order by
    case when p_sort = 'new' then null else h.rank end desc nulls last,
    h.created_at desc,
    h.id desc
  limit p_limit
  offset p_offset;
$$;

-- Postgres deja ejecutar cualquier función a PUBLIC por defecto: sin esto,
-- el cliente mobile podría llamarla directo con la anon key. Solo el backend.
revoke execute on function public.search_content(text, uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.search_content(text, uuid, text, integer, integer)
  to service_role;
revoke execute on function public.immutable_unaccent(text) from public, anon, authenticated;
grant execute on function public.immutable_unaccent(text) to service_role;

-- PostgREST (la API de Supabase que usa el backend con .rpc()) guarda en
-- caché las funciones que existen: sin esto, puede seguir respondiendo "no
-- encuentro search_content" hasta que se refresque solo.
notify pgrst, 'reload schema';
