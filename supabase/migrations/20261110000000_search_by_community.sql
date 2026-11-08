-- Búsqueda dentro de una comunidad (el 🔍 de la barra de la comunidad), además
-- de por panel. Se reemplaza search_content con un parámetro más,
-- p_community_id (null = todo el panel). El resto es igual que en
-- 20261108000000_full_text_search.sql.

drop function public.search_content(text, uuid, text, integer, integer);

create function public.search_content(
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

-- Igual que antes: solo el backend la puede ejecutar.
revoke execute on function public.search_content(text, uuid, uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.search_content(text, uuid, uuid, text, integer, integer)
  to service_role;

notify pgrst, 'reload schema';
