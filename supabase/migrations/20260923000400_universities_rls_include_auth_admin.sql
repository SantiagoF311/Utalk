-- Al activar RLS en universities (migración anterior) para el check en vivo
-- del mobile, sin querer también empezó a filtrar el acceso del rol que usa
-- el Auth Hook (supabase_auth_admin) — RLS aplica a todos los roles una vez
-- activo, no solo a los mencionados en la política. Lo agregamos acá.
alter policy "universities are publicly readable"
on universities
to anon, authenticated, supabase_auth_admin;
