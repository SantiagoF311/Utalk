-- profiles fue creada sin RLS (se accede solo vía backend con service role),
-- pero nunca se otorgó el permiso base de SQL sobre la tabla al rol
-- service_role — mismo problema que ya se corrigió para universities en
-- universities_grant_select.sql, pero acá hacen falta las 4 operaciones,
-- no solo SELECT, porque el backend crea/lee/actualiza perfiles.
grant select, insert, update, delete on public.profiles to service_role;
