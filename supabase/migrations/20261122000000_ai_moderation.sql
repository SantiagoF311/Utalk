-- Moderación por IA (ver docs/backend-y-colas.md): cada post nuevo se manda
-- a la API de moderación de OpenAI (texto e imagen). Si lo detecta como
-- inapropiado:
--   - se crea un reporte automático que va a la cola de moderación;
--   - el post queda RETENIDO: deja de verse para todos menos su autor (que
--     lo ve "En revisión" y recibe un aviso), hasta que un moderador decida.
--     Si lo deja, vuelve a verse; si lo elimina, queda eliminado.
-- La IA no elimina nada por su cuenta.

-- La IA revisa cada post al publicarse y también cuando se edita (si no, se
-- podría publicar algo inocente y después cambiarlo por algo grave).

-- 1. Un reporte puede venir de la IA, sin una persona que lo haya hecho.
alter table reports alter column reported_by drop not null;

alter table reports
  add column source text not null default 'user' check (source in ('user', 'ai'));

-- El de una persona siempre dice quién fue; el de la IA, nunca.
alter table reports add constraint reports_reporter_matches_source
  check ((source = 'ai') = (reported_by is null));

-- Un reporte PENDIENTE de la IA por post a la vez: un reintento del job no
-- duplica, y un post que un moderador dejó puede volver a marcarse si
-- después lo editan.
create unique index reports_one_pending_ai_per_post
  on reports (post_id) where source = 'ai' and status = 'pending';

-- 2. Post retenido por la IA mientras se revisa (null = visible). Distinto
--    de removed_at: no está eliminado y puede volver.
alter table posts add column held_at timestamptz;

-- 3. Aviso al autor de que su post quedó retenido. Puede repetirse (una vez
--    por retención); los reintentos del job no lo duplican porque solo se
--    manda cuando se crea el reporte.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('new_post_in_community', 'report_resolved', 'content_removed', 'content_held'));

-- 4. Lo que hace el worker cuando la IA marca un post, en una sola
--    transacción: el reporte, retener el post y avisarle al autor. En una
--    función también porque el unique de reportes es parcial y PostgREST no
--    puede usarlo para el `on conflict`. Devuelve si creó el reporte (false
--    = ya estaba: un reintento).
create function public.report_post_by_ai(p_post_id uuid, p_category text, p_reason text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_author uuid;
begin
  insert into public.reports (post_id, category, reason, source)
  values (p_post_id, p_category, p_reason, 'ai')
  on conflict (post_id) where source = 'ai' and status = 'pending' do nothing;
  if not found then
    return false;
  end if;

  update public.posts
  set held_at = now()
  where id = p_post_id and removed_at is null and held_at is null
  returning author_id into v_author;

  if v_author is not null then
    insert into public.notifications (user_id, type, post_id)
    values (v_author, 'content_held', p_post_id);
  end if;

  return true;
end;
$$;

-- 5. Resolver reportes: igual que antes, y además un post retenido que el
--    moderador deja vuelve a verse.
create or replace function public.resolve_reports(
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

  if v_closed = 0 then
    return v_closed;
  end if;

  if p_action = 'dismiss' then
    -- Lo dejó: si la IA lo había retenido, vuelve a verse.
    if p_post_id is not null then
      update public.posts set held_at = null where id = p_post_id;
    end if;
    return v_closed;
  end if;

  if p_post_id is not null then
    update public.posts
    set removed_at = now(), removed_by = p_resolved_by, held_at = null
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

-- 6. Un post retenido no cuenta en el perfil ni aparece en la búsqueda (como
--    uno eliminado). Mismos cuerpos que en 20261115000000_moderation, con
--    `held_at is null`.
create or replace function public.profile_stats(p_user_id uuid)
returns table (post_count integer, comment_count integer, karma integer)
language sql
stable
set search_path = ''
as $$
  select
    (select count(*)::integer from public.posts
      where author_id = p_user_id and removed_at is null and held_at is null),
    (select count(*)::integer from public.comments
      where author_id = p_user_id and deleted_at is null),
    (
      coalesce((select sum(score) from public.posts
          where author_id = p_user_id and removed_at is null and held_at is null), 0)
      + coalesce((select sum(score) from public.comments
          where author_id = p_user_id and deleted_at is null), 0)
    )::integer;
$$;

-- Ver la nota en 20261115000000_moderation: carga pg_trgm para poder fijar
-- su parámetro en la función.
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
      and p.held_at is null
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
      and p.held_at is null
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

-- 7. Avisos de post nuevo: no por un post retenido (si la IA lo marcó antes
--    de que corriera este job). Igual que en 20261120000000, con `held_at is null`.
create or replace function public.notify_new_post(p_post_id uuid)
returns integer
language sql
set search_path = ''
as $$
  with inserted as (
    insert into public.notifications (user_id, type, post_id)
    select m.user_id, 'new_post_in_community', p.id
    from public.posts p
    join public.community_members m on m.community_id = p.community_id
    where p.id = p_post_id
      and p.removed_at is null
      and p.held_at is null
      and m.user_id <> p.author_id
      and not exists (
        select 1 from public.user_blocks b
        where b.blocker_id = m.user_id and b.blocked_id = p.author_id
      )
    on conflict (user_id, post_id) where type = 'new_post_in_community' do nothing
    returning 1
  )
  select count(*)::integer from inserted;
$$;

-- 8. La lista y el contador de la campana: un aviso de post nuevo tampoco se
--    muestra si el post está retenido (si ya se había mandado). Los de
--    moderación, sí.
create or replace function public.notification_list(p_user_id uuid, p_limit integer)
returns table (
  id uuid,
  user_id uuid,
  type text,
  post_id uuid,
  comment_id uuid,
  read_at timestamptz,
  created_at timestamptz,
  post_title text,
  community_id uuid,
  community_slug text,
  community_name text,
  report_case_number bigint,
  report_status text
)
language sql
stable
set search_path = ''
as $$
  select
    n.id, n.user_id, n.type, n.post_id, n.comment_id, n.read_at, n.created_at,
    p.title, c.id, c.slug, c.name,
    r.case_number, r.status
  from public.notifications n
  join public.posts p on p.id = n.post_id
  join public.communities c on c.id = p.community_id
  left join public.reports r on r.id = n.report_id
  where n.user_id = p_user_id
    and (n.type <> 'new_post_in_community' or (p.removed_at is null and p.held_at is null))
  order by n.created_at desc, n.id desc
  limit p_limit;
$$;

create or replace function public.unread_notification_count(p_user_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.notifications n
  join public.posts p on p.id = n.post_id
  where n.user_id = p_user_id
    and n.read_at is null
    and (n.type <> 'new_post_in_community' or (p.removed_at is null and p.held_at is null));
$$;

-- 9. Cola de moderación: igual que antes, más si algún reporte es de la IA y
--    la imagen del post (si lo reportado es el post), para que el moderador
--    vea lo que la IA marcó. Cambia lo que devuelve: se borra y se recrea.
drop function public.moderation_queue(uuid[]);

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
  last_reported_at timestamptz,
  ai_flagged boolean,
  post_image_path text
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
    max(r.created_at),
    bool_or(r.source = 'ai'),
    case when r.comment_id is null then p.image_path end
  from public.reports r
  left join public.comments cm on cm.id = r.comment_id
  join public.posts p on p.id = coalesce(r.post_id, cm.post_id)
  join public.communities c on c.id = p.community_id
  join public.profiles pr on pr.id = coalesce(cm.author_id, p.author_id)
  where r.status = 'pending'
    and (p_community_ids is null or c.id = any (p_community_ids))
  group by p.id, r.comment_id, c.id, c.slug, p.title, p.body, p.image_path, cm.body,
    cm.deleted_at, pr.id, pr.username;
$$;

-- 10. Avisos de una resolución: los reportes de la IA no tienen a quién
--     avisarle. Igual que en 20261120000000, salvo `r.reported_by is not null`.
create or replace function public.notify_moderation_result(p_post_id uuid, p_comment_id uuid)
returns integer
language sql
set search_path = ''
as $$
  with closed_reports as (
    select r.id, r.reported_by, coalesce(r.post_id, c.post_id) as post_id, r.comment_id
    from public.reports r
    left join public.comments c on c.id = r.comment_id
    where r.status <> 'pending'
      and r.reported_by is not null
      and (
        (p_post_id is not null and (r.post_id = p_post_id or c.post_id = p_post_id))
        or (p_comment_id is not null and r.comment_id = p_comment_id)
      )
  ),
  reporters as (
    insert into public.notifications (user_id, type, post_id, comment_id, report_id)
    select reported_by, 'report_resolved', post_id, comment_id, id from closed_reports
    on conflict (report_id) where type = 'report_resolved' do nothing
    returning 1
  ),
  authors as (
    insert into public.notifications (user_id, type, post_id, comment_id)
    select p.author_id, 'content_removed', p.id, null::uuid
    from public.posts p
    where p.id = p_post_id and p.removed_at is not null
    union all
    select c.author_id, 'content_removed', c.post_id, c.id
    from public.comments c
    where c.id = p_comment_id and c.removed_at is not null
    on conflict (post_id, comment_id) where type = 'content_removed' do nothing
    returning 1
  )
  select ((select count(*) from reporters) + (select count(*) from authors))::integer;
$$;

-- 11. Funciones nuevas o recreadas con `drop`: solo el backend (`create or
--     replace` conserva los permisos de las que ya existían).
revoke execute on function public.report_post_by_ai(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.report_post_by_ai(uuid, text, text) to service_role;
revoke execute on function public.moderation_queue(uuid[]) from public, anon, authenticated;
grant execute on function public.moderation_queue(uuid[]) to service_role;

notify pgrst, 'reload schema';
