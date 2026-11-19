-- Push del chat (ver docs/chat-realtime.md): los celulares donde cada
-- usuario tiene la app abierta con sesión, para avisarle de un mensaje nuevo
-- con la app cerrada. Los manda el backend por el servicio de push de Expo.
--
-- Acceso: solo el backend (service role). RLS sin políticas: el mobile
-- registra y borra su token por la API, nunca directo.

create table push_tokens (
  -- El token de Expo identifica el celular. Si otra cuenta entra en el
  -- mismo celular, el token pasa a esa cuenta (upsert): un celular avisa de
  -- una sola cuenta, la que tiene la sesión.
  token text primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  -- Última vez que la app lo registró (al abrirse con sesión).
  updated_at timestamptz not null default now()
);

-- Los celulares de un usuario, al mandarle un aviso.
create index push_tokens_by_user on push_tokens (user_id);

alter table push_tokens enable row level security;

grant select, insert, update, delete on push_tokens to service_role;

notify pgrst, 'reload schema';
