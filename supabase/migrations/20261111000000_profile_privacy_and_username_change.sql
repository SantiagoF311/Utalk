-- Perfil: privacidad (por defecto público, como Reddit), cambio de apodo cada
-- 30 días con el viejo reservado, y contadores del perfil.

alter table profiles
  -- Privado: los demás ven el apodo, la universidad y la antigüedad, pero no
  -- el historial ni los contadores. Lo publicado se sigue viendo donde está.
  add column is_private boolean not null default false,
  -- Último cambio de apodo (null = nunca). El backend no deja otro cambio
  -- hasta 30 días después.
  add column username_changed_at timestamptz;

-- Apodos que alguien dejó: quedan reservados (solo para quien lo dejó) hasta
-- `reserved_until`, para que nadie más tome el apodo viejo de otro y se haga
-- pasar por él. Vencida la fecha, el apodo vuelve a estar libre.
create table reserved_usernames (
  username text primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  reserved_until timestamptz not null
);

-- Sin RLS: solo se accede vía backend (service role), igual que profiles.
grant select, insert, update, delete on public.reserved_usernames to service_role;

-- Contadores del perfil: publicaciones, comentarios (sin los borrados) y
-- votos recibidos (suma de puntajes). Se calculan al pedirlos: el perfil se
-- abre poco comparado con el feed, así que no vale la pena mantener
-- contadores con triggers.
create function public.profile_stats(p_user_id uuid)
returns table (post_count integer, comment_count integer, karma integer)
language sql
stable
set search_path = ''
as $$
  select
    (select count(*)::integer from public.posts where author_id = p_user_id),
    (select count(*)::integer from public.comments
      where author_id = p_user_id and deleted_at is null),
    (
      coalesce((select sum(score) from public.posts where author_id = p_user_id), 0)
      + coalesce((select sum(score) from public.comments
          where author_id = p_user_id and deleted_at is null), 0)
    )::integer;
$$;

-- Postgres deja ejecutar cualquier función a PUBLIC por defecto: solo el backend.
revoke execute on function public.profile_stats(uuid) from public, anon, authenticated;
grant execute on function public.profile_stats(uuid) to service_role;

-- Para que la API de Supabase vea la función nueva sin esperar.
notify pgrst, 'reload schema';
