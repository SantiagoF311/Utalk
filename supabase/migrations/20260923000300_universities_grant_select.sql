-- La política de RLS (migración anterior) controla qué filas se ven, pero
-- no alcanza sin el permiso base de SELECT sobre la tabla para los roles
-- que usa el cliente de Supabase.
grant select on public.universities to anon, authenticated;
