-- Dos cambios en los avisos (ver docs/backend-y-colas.md):
--
-- 1. El autor se entera de cualquier resolución sobre lo suyo, no solo si se
--    eliminó: si un moderador lo deja, recibe `content_kept` (y un post que
--    la IA había retenido vuelve a verse).
-- 2. Cada notificación también se manda por push. Para eso las funciones que
--    las crean devuelven los ids de las que crearon: el backend encola el
--    push de exactamente esas (un reintento del job no crea ninguna, así que
--    tampoco repite el push).

-- 1. Tipo nuevo. Como `report_resolved`, apunta a un reporte: el último que
--    se cerró como "dejado". Así un reintento del job choca con el unique y
--    no duplica, y si el mismo contenido se vuelve a reportar y a dejar más
--    adelante, es un reporte distinto y vuelve a avisar.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'new_post_in_community', 'report_resolved', 'content_removed', 'content_held', 'content_kept'
  ));

alter table notifications drop constraint notifications_report_only_when_resolved;
alter table notifications add constraint notifications_report_only_when_resolved
  check ((type in ('report_resolved', 'content_kept')) = (report_id is not null));

create unique index notifications_one_kept
  on notifications (report_id) where type = 'content_kept';

-- 2. Avisos de post nuevo: igual que en 20261122000000, pero devuelve los ids
--    creados (antes, cuántos). Cambia lo que devuelve: se borra y se recrea.
drop function public.notify_new_post(uuid);

create function public.notify_new_post(p_post_id uuid)
returns table (id uuid)
language sql
set search_path = ''
as $$
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
  returning notifications.id;
$$;

-- 3. Avisos de una resolución: igual que en 20261122000000, más el autor
--    cuando se deja (`content_kept`), y devuelve los ids creados.
drop function public.notify_moderation_result(uuid, uuid);

create function public.notify_moderation_result(p_post_id uuid, p_comment_id uuid)
returns table (id uuid)
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
    returning notifications.id
  ),
  removed as (
    insert into public.notifications (user_id, type, post_id, comment_id)
    select p.author_id, 'content_removed', p.id, null::uuid
    from public.posts p
    where p.id = p_post_id and p.removed_at is not null
    union all
    select c.author_id, 'content_removed', c.post_id, c.id
    from public.comments c
    where c.id = p_comment_id and c.removed_at is not null
    on conflict (post_id, comment_id) where type = 'content_removed' do nothing
    returning notifications.id
  ),
  -- Se dejó: sigue publicado (un comentario que su autor borró después ya
  -- no le interesa a nadie). Uno por el último reporte que se cerró así.
  kept as (
    insert into public.notifications (user_id, type, post_id, comment_id, report_id)
    select p.author_id, 'content_kept', p.id, null::uuid, last_report.id
    from public.posts p
    cross join lateral (
      select r.id from public.reports r
      where r.post_id = p.id and r.status = 'dismissed'
      order by r.resolved_at desc, r.id desc
      limit 1
    ) last_report
    where p.id = p_post_id and p.removed_at is null
    union all
    select c.author_id, 'content_kept', c.post_id, c.id, last_report.id
    from public.comments c
    cross join lateral (
      select r.id from public.reports r
      where r.comment_id = c.id and r.status = 'dismissed'
      order by r.resolved_at desc, r.id desc
      limit 1
    ) last_report
    where c.id = p_comment_id and c.removed_at is null and c.deleted_at is null
    on conflict (report_id) where type = 'content_kept' do nothing
    returning notifications.id
  )
  select id from reporters
  union all
  select id from removed
  union all
  select id from kept;
$$;

-- 4. Reporte de la IA: igual que en 20261122000000, pero además del si creó
--    el reporte devuelve el id del aviso al autor (para su push).
drop function public.report_post_by_ai(uuid, text, text);

create function public.report_post_by_ai(p_post_id uuid, p_category text, p_reason text)
returns table (reported boolean, notification_id uuid)
language plpgsql
set search_path = ''
as $$
declare
  v_author uuid;
  v_notification uuid;
begin
  insert into public.reports (post_id, category, reason, source)
  values (p_post_id, p_category, p_reason, 'ai')
  on conflict (post_id) where source = 'ai' and status = 'pending' do nothing;
  if not found then
    return query select false, null::uuid;
    return;
  end if;

  update public.posts
  set held_at = now()
  where posts.id = p_post_id and removed_at is null and held_at is null
  returning author_id into v_author;

  if v_author is not null then
    insert into public.notifications (user_id, type, post_id)
    values (v_author, 'content_held', p_post_id)
    returning notifications.id into v_notification;
  end if;

  return query select true, v_notification;
end;
$$;

-- 5. Los datos de unas notificaciones puntuales para armar su push: lo
--    mismo que `notification_list`, por id.
create function public.notifications_by_ids(p_ids uuid[])
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
  where n.id = any (p_ids);
$$;

-- 6. Funciones recreadas o nuevas: solo el backend.
revoke execute on function public.notify_new_post(uuid) from public, anon, authenticated;
grant execute on function public.notify_new_post(uuid) to service_role;
revoke execute on function public.notify_moderation_result(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.notify_moderation_result(uuid, uuid) to service_role;
revoke execute on function public.report_post_by_ai(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.report_post_by_ai(uuid, text, text) to service_role;
revoke execute on function public.notifications_by_ids(uuid[]) from public, anon, authenticated;
grant execute on function public.notifications_by_ids(uuid[]) to service_role;

notify pgrst, 'reload schema';
