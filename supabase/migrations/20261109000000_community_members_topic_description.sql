-- Comunidades: descripción, tema (para explorar por tema) y miembros
-- (unirse / "Tus comunidades").

alter table communities
  add column description text not null default ''
    check (char_length(description) <= 300),
  add column topic text not null default 'other'
    check (topic in (
      'academic', 'campus_life', 'marketplace', 'events', 'sports', 'venting',
      'lost_and_found', 'other'
    )),
  -- Contador de miembros: lo mantiene el trigger de abajo, igual que
  -- comment_count en posts (se lee en cada lista, contar cada vez saldría caro).
  add column member_count integer not null default 0;

-- Quién se unió a qué comunidad. Unirse es seguir: se puede en cualquier
-- panel (leer es libre), aunque publicar no.
create table community_members (
  community_id uuid not null references communities (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

-- Para "las comunidades de un usuario" (la PK ya cubre "los miembros de una").
create index community_members_user_id_idx on community_members (user_id);

create function apply_member_to_community_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update communities set member_count = member_count + 1 where id = new.community_id;
  elsif tg_op = 'DELETE' then
    update communities set member_count = member_count - 1 where id = old.community_id;
  end if;
  return null;
end;
$$;

create trigger community_members_apply_count
  after insert or delete on community_members
  for each row
  execute function apply_member_to_community_count();

-- Quien crea una comunidad queda unido (además de moderador, que ya lo hace
-- communities_add_creator_as_moderator). Con trigger por lo mismo que el de
-- moderadores: atómico, sin depender de un segundo insert del backend.
create function add_community_creator_as_member()
returns trigger
language plpgsql
as $$
begin
  insert into community_members (community_id, user_id)
  values (new.id, new.created_by);
  return new;
end;
$$;

create trigger communities_add_creator_as_member
  after insert on communities
  for each row
  execute function add_community_creator_as_member();

-- Comunidades que ya existían: su creador queda como miembro (el trigger de
-- conteo suma solo).
insert into community_members (community_id, user_id)
select id, created_by from communities
on conflict do nothing;

-- Sin RLS: solo se accede vía backend (service role), igual que communities.
grant select, insert, update, delete on public.community_members to service_role;
