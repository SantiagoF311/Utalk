-- Chat 1 a 1 (ver docs/chat-realtime.md): conversaciones, mensajes y
-- bloqueos.
--
-- Acceso: el mobile **escribe siempre por la API** (el backend, con service
-- role, aplica las reglas: solicitudes, bloqueos, largo). Directo de
-- Supabase solo **lee** conversaciones y mensajes por Realtime, así que esas
-- dos tablas llevan RLS con políticas de SELECT para quien participa, y
-- nada más. `user_blocks` es solo del backend: RLS sin políticas.

-- 1. Conversaciones: una por par de usuarios. user_a < user_b para que el
--    mismo par no pueda quedar guardado dos veces (a,b) y (b,a).
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles (id) on delete cascade,
  user_b uuid not null references profiles (id) on delete cascade,
  -- Quien escribió primero. Mientras accepted_at sea null, es una
  -- solicitud: el otro la acepta respondiendo.
  initiated_by uuid not null references profiles (id) on delete cascade,
  accepted_at timestamptz,
  -- Fecha del último mensaje (la mantiene un trigger): ordena la lista.
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint conversations_users_ordered check (user_a < user_b),
  constraint conversations_initiator_is_participant check (initiated_by in (user_a, user_b)),
  constraint conversations_one_per_pair unique (user_a, user_b)
);

-- "Mis conversaciones" busca por cualquiera de los dos lados (user_a ya está
-- cubierto por el índice del unique).
create index conversations_user_b on conversations (user_b);

-- 2. Mensajes.
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  -- Cuándo lo leyó el otro (null = no lo leyó). Realtime le avisa al que lo
  -- mandó con el UPDATE ("Visto").
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Historial paginado por cursor (más nuevo primero) y "no leídos".
create index messages_by_conversation on messages (conversation_id, created_at desc, id desc);
create index messages_unread on messages (conversation_id) where read_at is null;

-- 3. Bloqueos: quien bloquea deja de recibir mensajes de esa persona (y no
--    puede escribirle hasta desbloquear). El bloqueado no se entera.
create table user_blocks (
  blocker_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

-- 4. last_message_at por trigger, en la misma transacción que el mensaje
--    (mismo criterio que los contadores de posts).
create function touch_conversation_on_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on messages
  for each row execute function touch_conversation_on_message();

revoke execute on function public.touch_conversation_on_message() from public, anon, authenticated;

-- 5. Empezar una conversación con su primer mensaje, en una sola transacción
--    (el cliente de Supabase no maneja transacciones): si el mensaje falla,
--    no queda una conversación vacía. Devuelve el id de la conversación y el
--    del mensaje.
create function public.start_conversation(p_sender uuid, p_recipient uuid, p_body text)
returns table (conversation_id uuid, message_id uuid)
language plpgsql
set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_message_id uuid;
begin
  insert into public.conversations (user_a, user_b, initiated_by)
  values (least(p_sender, p_recipient), greatest(p_sender, p_recipient), p_sender)
  returning id into v_conversation_id;

  insert into public.messages (conversation_id, sender_id, body)
  values (v_conversation_id, p_sender, p_body)
  returning id into v_message_id;

  return query select v_conversation_id, v_message_id;
end;
$$;

-- 6. Las conversaciones de un usuario con lo que muestra la lista: el otro
--    participante (apodo y universidad), el último mensaje y cuántos no
--    leyó. Sin las de alguien que él bloqueó. p_conversation_id = una sola
--    (el detalle); null = todas.
create function public.conversation_summaries(p_user_id uuid, p_conversation_id uuid)
returns table (
  id uuid,
  user_a uuid,
  user_b uuid,
  initiated_by uuid,
  accepted_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz,
  other_id uuid,
  other_username text,
  other_university_id uuid,
  other_university_slug text,
  other_university_name text,
  last_body text,
  last_sender_id uuid,
  last_created_at timestamptz,
  unread_count integer
)
language sql
stable
set search_path = ''
as $$
  select
    c.id, c.user_a, c.user_b, c.initiated_by, c.accepted_at, c.last_message_at, c.created_at,
    o.id, o.username, u.id, u.slug, u.name,
    last.body, last.sender_id, last.created_at,
    (
      select count(*)::integer from public.messages m
      where m.conversation_id = c.id and m.sender_id <> p_user_id and m.read_at is null
    )
  from public.conversations c
  join public.profiles o
    on o.id = case when c.user_a = p_user_id then c.user_b else c.user_a end
  join public.universities u on u.id = o.university_id
  left join lateral (
    select m.body, m.sender_id, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) last on true
  where p_user_id in (c.user_a, c.user_b)
    and (p_conversation_id is null or c.id = p_conversation_id)
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = p_user_id and b.blocked_id = o.id
    )
  order by c.last_message_at desc;
$$;

-- 7. Acceso.
alter table conversations enable row level security;
alter table messages enable row level security;
alter table user_blocks enable row level security;

-- El backend (service role) lee y escribe todo.
grant select, insert, update, delete on conversations, messages, user_blocks to service_role;

-- El mobile solo lee, y solo lo suyo: lo necesita Realtime para entregarle
-- los mensajes nuevos y los "Visto". Sin INSERT/UPDATE/DELETE: escribir va
-- por la API. user_blocks no se expone.
grant select on conversations, messages to authenticated;

create policy conversations_select_participant on conversations
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy messages_select_participant on messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.user_a, c.user_b)
    )
  );

-- Funciones: solo el backend.
revoke execute on function public.start_conversation(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.start_conversation(uuid, uuid, text) to service_role;
revoke execute on function public.conversation_summaries(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.conversation_summaries(uuid, uuid) to service_role;

-- 8. Realtime: que Supabase emita los cambios de estas tablas (respetando
--    las políticas de arriba para cada suscriptor).
alter publication supabase_realtime add table messages, conversations;

notify pgrst, 'reload schema';
