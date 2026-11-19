-- Notificaciones in-app (ver docs/backend-y-colas.md). Por ahora un solo
-- tipo: se publicó un post en una comunidad a la que el usuario se unió
-- (unirse es seguir). Las crea el worker de BullMQ (cola `notifications`,
-- job `notify-subscribers`), nunca el request que crea el post.
--
-- Acceso: el backend (service role) escribe y lee todo. El mobile solo lee
-- las suyas por Realtime (para enterarse de las nuevas sin recargar);
-- marcarlas como leídas va por la API.

-- 1. Notificaciones: una por destinatario y post. El unique hace idempotente
--    al job: si BullMQ lo reintenta, no se duplican.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type text not null check (type in ('new_post_in_community')),
  post_id uuid not null references posts (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_one_per_post unique (user_id, post_id, type)
);

-- Lista (más nueva primero) y contador de no leídas.
create index notifications_by_user on notifications (user_id, created_at desc, id desc);
create index notifications_unread on notifications (user_id) where read_at is null;

-- 2. Fan-out en un solo insert: una notificación por miembro de la comunidad
--    del post, salvo el autor y quien lo bloqueó. Un post ya eliminado por
--    moderación no notifica. Devuelve cuántas creó (0 en un reintento).
create function public.notify_new_post(p_post_id uuid)
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
    on conflict (user_id, post_id, type) do nothing
    returning 1
  )
  select count(*)::integer from inserted;
$$;

-- 3. Acceso.
alter table notifications enable row level security;

grant select, insert, update, delete on notifications to service_role;

-- El mobile solo lee, y solo las suyas (lo necesita Realtime).
grant select on notifications to authenticated;

create policy notifications_select_own on notifications
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke execute on function public.notify_new_post(uuid) from public, anon, authenticated;
grant execute on function public.notify_new_post(uuid) to service_role;

-- 4. Realtime: emitir las notificaciones nuevas a su destinatario.
alter publication supabase_realtime add table notifications;

notify pgrst, 'reload schema';
