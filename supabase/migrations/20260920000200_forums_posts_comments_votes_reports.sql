-- Un panel por universidad (unique), más uno general (university_id null).
create table panels (
  id uuid primary key default gen_random_uuid(),
  university_id uuid unique references universities (id),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- Foros (tipo subreddit), creados por usuarios, únicos por panel.
create table forums (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references panels (id) on delete cascade,
  slug text not null,
  name text not null,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  unique (panel_id, slug)
);

create index forums_panel_id_idx on forums (panel_id);

create table posts (
  id uuid primary key default gen_random_uuid(),
  forum_id uuid not null references forums (id) on delete cascade,
  author_id uuid not null references profiles (id),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index posts_forum_id_idx on posts (forum_id);
create index posts_author_id_idx on posts (author_id);

-- Comentarios anidados: parent_id null = comentario raíz del post.
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  parent_id uuid references comments (id) on delete cascade,
  author_id uuid not null references profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create index comments_post_id_idx on comments (post_id);
create index comments_parent_id_idx on comments (parent_id);

create table post_votes (
  post_id uuid not null references posts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table comment_votes (
  comment_id uuid not null references comments (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- Reportes: exactamente uno de post_id/comment_id debe estar presente.
create table reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts (id) on delete cascade,
  comment_id uuid references comments (id) on delete cascade,
  reported_by uuid not null references profiles (id),
  reason text not null,
  created_at timestamptz not null default now(),
  constraint reports_exactly_one_target check (
    (post_id is not null and comment_id is null) or
    (post_id is null and comment_id is not null)
  )
);

create index reports_post_id_idx on reports (post_id);
create index reports_comment_id_idx on reports (comment_id);

-- Sin RLS: todas estas tablas se leen/escriben exclusivamente a través del
-- backend (service role). El cliente mobile no las toca directo vía
-- Realtime. Ver docs/auth.md y CLAUDE.md para el criterio completo.
