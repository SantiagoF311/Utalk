-- Rol global de plataforma. Solo 'user' | 'admin': la moderación con alcance
-- (por foro) no es un rol, es una fila en forum_moderators. Se asigna a mano
-- desde Supabase; nunca se acepta desde la API.
alter table profiles
  add column role text not null default 'user'
  check (role in ('user', 'admin'));

-- Moderadores por foro (tipo mods de un subreddit). Ser moderador de un foro
-- = existir una fila acá; los admins moderan todo sin necesitar filas.
create table forum_moderators (
  forum_id uuid not null references forums (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (forum_id, user_id)
);

create index forum_moderators_user_id_idx on forum_moderators (user_id);

-- El creador de un foro es su primer moderador. Se hace con trigger (y no
-- con dos inserts desde el backend) para que sea atómico: el cliente de
-- Supabase no maneja transacciones.
create function add_forum_creator_as_moderator()
returns trigger
language plpgsql
as $$
begin
  insert into forum_moderators (forum_id, user_id)
  values (new.id, new.created_by);
  return new;
end;
$$;

create trigger forums_add_creator_as_moderator
  after insert on forums
  for each row
  execute function add_forum_creator_as_moderator();

-- Foros que ya existían antes de esta migración.
insert into forum_moderators (forum_id, user_id)
select id, created_by from forums
on conflict do nothing;

-- Sin RLS: solo se accede vía backend (service role), igual que forums.
grant select, insert, update, delete on public.forum_moderators to service_role;
