-- Moderación: los reportes pasan a tener estado (en vez de borrarse al
-- resolverlos), número de caso y quién los resolvió; los posts y comentarios
-- se pueden eliminar por moderación sin perder el historial.

-- 1. Estado de los reportes. Los que ya existían quedan pendientes.
alter table reports
  add column status text not null default 'pending'
    check (status in ('pending', 'removed', 'dismissed')),
  add column resolved_by uuid references profiles (id) on delete set null,
  add column resolved_at timestamptz,
  -- Número legible para quien reportó ("caso #42"). Identity llena también
  -- las filas que ya existían.
  add column case_number bigint generated always as identity;

alter table reports
  add constraint reports_case_number_key unique (case_number),
  -- Pendiente <=> sin fecha de resolución.
  add constraint reports_resolved_when_not_pending
    check ((status = 'pending') = (resolved_at is null));

-- La cola de moderación solo lee pendientes; "Mis reportes", los de una persona.
create index reports_pending on reports (post_id, comment_id) where status = 'pending';
create index reports_by_reporter on reports (reported_by, created_at desc);

-- 2. Eliminado por moderación. Va aparte del borrado del autor: así la app
--    puede decir "eliminado por moderación" y el historial queda.
alter table posts
  add column removed_at timestamptz,
  add column removed_by uuid references profiles (id) on delete set null;

-- En comentarios, eliminar por moderación también llena deleted_at: así
-- todo lo que ya filtra borrados (árbol, perfil, búsqueda, contadores) los
-- deja afuera sin cambios, y removed_at dice por qué.
alter table comments
  add column removed_at timestamptz,
  add column removed_by uuid references profiles (id) on delete set null;

-- 3. Cola de moderación: una fila por contenido con reportes pendientes,
--    con cuántos son, sus motivos y detalles. p_community_ids null = todas
--    (admins). El orden por gravedad lo decide el backend. post_id es
--    siempre la publicación (la del comentario, si es un comentario);
--    comment_id solo viene si lo reportado es un comentario.
create function public.moderation_queue(p_community_ids uuid[])
returns table (
  post_id uuid,
  comment_id uuid,
  community_id uuid,
  community_slug text,
  post_title text,
  body text,
  author_id uuid,
  author_username text,
  is_deleted boolean,
  report_count integer,
  categories text[],
  reasons text[],
  first_reported_at timestamptz,
  last_reported_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    p.id,
    r.comment_id,
    c.id,
    c.slug,
    p.title,
    coalesce(cm.body, p.body),
    pr.id,
    pr.username,
    coalesce(cm.deleted_at is not null, false),
    count(*)::integer,
    array_agg(distinct r.category),
    array_remove(array_agg(r.reason order by r.created_at), null),
    min(r.created_at),
    max(r.created_at)
  from public.reports r
  left join public.comments cm on cm.id = r.comment_id
  join public.posts p on p.id = coalesce(r.post_id, cm.post_id)
  join public.communities c on c.id = p.community_id
  join public.profiles pr on pr.id = coalesce(cm.author_id, p.author_id)
  where r.status = 'pending'
    and (p_community_ids is null or c.id = any (p_community_ids))
  group by p.id, r.comment_id, c.id, c.slug, p.title, p.body, cm.body, cm.deleted_at,
    pr.id, pr.username;
$$;

-- 4. Resolver todos los reportes pendientes de un contenido de una vez y, si
--    se elimina, marcarlo. En una función para que sea una sola transacción
--    (el cliente de Supabase no maneja transacciones). Devuelve cuántos
--    reportes cerró (0 = no había pendientes: otro moderador se adelantó).
create function public.resolve_reports(
  p_post_id uuid,
  p_comment_id uuid,
  p_action text,
  p_resolved_by uuid
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_status text := case p_action when 'remove' then 'removed' when 'dismiss' then 'dismissed' end;
  v_closed integer;
begin
  if v_status is null then
    raise exception 'unknown moderation action: %', p_action;
  end if;
  if (p_post_id is null) = (p_comment_id is null) then
    raise exception 'exactly one of p_post_id or p_comment_id must be set';
  end if;

  update public.reports
  set status = v_status, resolved_by = p_resolved_by, resolved_at = now()
  where status = 'pending'
    and post_id is not distinct from p_post_id
    and comment_id is not distinct from p_comment_id;
  get diagnostics v_closed = row_count;

  if v_closed = 0 or p_action <> 'remove' then
    return v_closed;
  end if;

  if p_post_id is not null then
    update public.posts
    set removed_at = now(), removed_by = p_resolved_by
    where id = p_post_id and removed_at is null;

    -- Los comentarios del post desaparecen con él: sus reportes pendientes
    -- también se cierran como eliminados.
    update public.reports r
    set status = 'removed', resolved_by = p_resolved_by, resolved_at = now()
    from public.comments cm
    where cm.id = r.comment_id and cm.post_id = p_post_id and r.status = 'pending';
  else
    update public.comments
    set removed_at = now(), removed_by = p_resolved_by, deleted_at = coalesce(deleted_at, now())
    where id = p_comment_id and removed_at is null;
  end if;

  return v_closed;
end;
$$;

-- 5. Lo eliminado por moderación deja de contar en el perfil y en la
--    búsqueda. Los comentarios ya quedan afuera por deleted_at; faltan los
--    posts. Mismo cuerpo que en 20261111000000 y 20261110000000, con
--    `removed_at is null`.
create or replace function public.profile_stats(p_user_id uuid)
returns table (post_count integer, comment_count integer, karma integer)
language sql
stable
set search_path = ''
as $$
  select
    (select count(*)::integer from public.posts
      where author_id = p_user_id and removed_at is null),
    (select count(*)::integer from public.comments
      where author_id = p_user_id and deleted_at is null),
    (
      coalesce((select sum(score) from public.posts
          where author_id = p_user_id and removed_at is null), 0)
      + coalesce((select sum(score) from public.comments
          where author_id = p_user_id and deleted_at is null), 0)
    )::integer;
$$;

-- `set pg_trgm.word_similarity_threshold` (abajo) solo se acepta si la
-- librería de pg_trgm ya está cargada en esta sesión; si no, Postgres lo trata
-- como un parámetro desconocido y no deja definirlo sin ser superusuario
-- ("permission denied to set parameter"). Llamar a cualquier función de
-- pg_trgm la carga.
select extensions.similarity('', '');

create or replace function public.search_content(
  p_query text,
  p_panel_id uuid,
  p_community_id uuid,
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
    select
      lower(public.immutable_unaccent(p_query)) as plain,
      array_remove(
        regexp_split_to_array(lower(public.immutable_unaccent(p_query)), '[^a-z0-9]+'),
        ''
      ) as list
  ),
  q as (
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
      and (p_community_id is null or p.community_id = p_community_id)
      and p.removed_at is null
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
      and (p_community_id is null or p.community_id = p_community_id)
      and p.removed_at is null
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

-- Solo el backend ejecuta las funciones nuevas (create or replace conserva
-- los permisos de las reemplazadas).
revoke execute on function public.moderation_queue(uuid[]) from public, anon, authenticated;
grant execute on function public.moderation_queue(uuid[]) to service_role;
revoke execute on function public.resolve_reports(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_reports(uuid, uuid, text, uuid) to service_role;

notify pgrst, 'reload schema';
