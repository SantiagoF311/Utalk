-- Avisos de moderación (ver docs/backend-y-colas.md): cuando un moderador
-- resuelve un contenido reportado, se avisa
--   - a cada persona que lo reportó (`report_resolved`): su caso y en qué
--     quedó (eliminado o se dejó);
--   - al autor, si se eliminó (`content_removed`). Nunca dice quién reportó.
-- Las crea el worker de BullMQ (job `notify-moderation-result`), nunca el
-- request que resuelve.

-- 1. Columnas para los tipos nuevos. post_id sigue siendo obligatorio: en un
--    comentario es el post donde está (para mostrar el título y abrirlo).
alter table notifications
  add column report_id uuid references reports (id) on delete cascade,
  add column comment_id uuid references comments (id) on delete cascade;

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('new_post_in_community', 'report_resolved', 'content_removed'));

-- Un aviso de reporte siempre dice de qué reporte; los demás, nunca.
alter table notifications add constraint notifications_report_only_when_resolved
  check ((type = 'report_resolved') = (report_id is not null));

-- 2. Idempotencia por tipo (antes había un solo unique (user_id, post_id,
--    type), que no sirve para reportes: alguien puede haber reportado dos
--    comentarios del mismo post).
alter table notifications drop constraint notifications_one_per_post;

create unique index notifications_one_new_post
  on notifications (user_id, post_id) where type = 'new_post_in_community';
create unique index notifications_one_per_report
  on notifications (report_id) where type = 'report_resolved';
-- comment_id null = el post: `nulls not distinct` para que el post también
-- cuente una sola vez.
create unique index notifications_one_removal
  on notifications (post_id, comment_id) nulls not distinct where type = 'content_removed';

-- 3. notify_new_post: igual que antes, con el unique nuevo.
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

-- 4. Avisos de una resolución. Exactamente uno de p_post_id / p_comment_id
--    (el contenido resuelto). Mira el estado ya guardado, así que sirve
--    igual si el job se reintenta: lo ya avisado choca con los unique.
--    - Reportes cerrados de ese contenido. Si se eliminó un post, también
--      los de sus comentarios (`resolve_reports` los cierra con él).
--    - El autor, si el contenido quedó eliminado.
create function public.notify_moderation_result(p_post_id uuid, p_comment_id uuid)
returns integer
language sql
set search_path = ''
as $$
  with closed_reports as (
    select r.id, r.reported_by, coalesce(r.post_id, c.post_id) as post_id, r.comment_id
    from public.reports r
    left join public.comments c on c.id = r.comment_id
    where r.status <> 'pending'
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

-- 5. La lista y el contador de la campana. Un aviso de post nuevo no se
--    muestra si el post se eliminó; los de moderación, justamente en ese
--    caso, sí. Ese filtro por tipo no se puede armar con los filtros de
--    PostgREST sobre la tabla, por eso son funciones.
create function public.notification_list(p_user_id uuid, p_limit integer)
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
    and (n.type <> 'new_post_in_community' or p.removed_at is null)
  order by n.created_at desc, n.id desc
  limit p_limit;
$$;

create function public.unread_notification_count(p_user_id uuid)
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
    and (n.type <> 'new_post_in_community' or p.removed_at is null);
$$;

-- 6. Funciones: solo el backend.
revoke execute on function public.notify_moderation_result(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.notify_moderation_result(uuid, uuid) to service_role;
revoke execute on function public.notification_list(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.notification_list(uuid, integer) to service_role;
revoke execute on function public.unread_notification_count(uuid)
  from public, anon, authenticated;
grant execute on function public.unread_notification_count(uuid) to service_role;

notify pgrst, 'reload schema';
