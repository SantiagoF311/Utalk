-- Catálogo cerrado de universidades soportadas.
create table universities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  email_domain text not null unique,
  created_at timestamptz not null default now()
);

-- Perfil público del usuario, 1 a 1 con auth.users.
-- auth.users guarda el email/credenciales; acá va todo lo propio del dominio.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  university_id uuid not null references universities (id),
  created_at timestamptz not null default now()
);

create index profiles_university_id_idx on profiles (university_id);

-- Sin RLS: estas tablas solo se leen/escriben a través del backend
-- (service role), el cliente mobile no las toca directo vía Realtime.
-- Ver docs/auth.md y CLAUDE.md para el criterio completo.
