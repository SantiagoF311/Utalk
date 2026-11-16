-- Bloquear ya no saca la conversación de la lista de quien bloqueó (como
-- WhatsApp): sigue ahí, marcada, y se puede desbloquear desde el chat. Ver
-- docs/chat-realtime.md.
--
-- conversation_summaries deja de filtrar las conversaciones con alguien que
-- el usuario bloqueó y devuelve `blocked_by_me` y `blocked_by_other`: el
-- chat de quien bloqueó muestra Desbloquear, y el de quien fue bloqueado
-- avisa que lo bloquearon y no deja escribir (como Reddit: el bloqueado se
-- entera). Cambia lo que devuelve, así que hay que borrarla y crearla de
-- nuevo (create or replace no alcanza); por lo mismo, este archivo se puede
-- volver a correr. El resto es igual que en 20261116000000_chat.sql.

drop function if exists public.conversation_summaries(uuid, uuid);

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
  unread_count integer,
  -- Si el usuario bloqueó a la otra persona, y si la otra persona lo
  -- bloqueó a él.
  blocked_by_me boolean,
  blocked_by_other boolean
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
    ),
    exists (
      select 1 from public.user_blocks b
      where b.blocker_id = p_user_id and b.blocked_id = o.id
    ),
    exists (
      select 1 from public.user_blocks b
      where b.blocker_id = o.id and b.blocked_id = p_user_id
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
  order by c.last_message_at desc;
$$;

-- Igual que antes: solo el backend.
revoke execute on function public.conversation_summaries(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.conversation_summaries(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
