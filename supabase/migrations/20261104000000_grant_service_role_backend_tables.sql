-- El proyecto de Supabase no otorga permisos automáticos sobre las tablas
-- nuevas, y el backend (service_role) quedó sin el permiso base de SQL
-- sobre casi todas: cualquier consulta fallaba con "permission denied",
-- aunque service_role bypasee RLS. Mismo problema que ya se corrigió para
-- profiles (profiles_grant_service_role.sql), ahora para el resto.
grant select on public.universities to service_role;

grant select, insert, update, delete on
  public.panels,
  public.forums,
  public.posts,
  public.comments,
  public.post_votes,
  public.comment_votes,
  public.reports
to service_role;

grant execute on function public.hot_score(integer, timestamptz) to service_role;

-- Para que no vuelva a pasar con cada tabla nueva: lo que se cree de acá en
-- adelante en public queda accesible para el backend. Solo service_role
-- (usado únicamente por el backend, nunca por el cliente) — anon y
-- authenticated siguen necesitando grants explícitos, porque esos sí los
-- usa el mobile y deben ir acompañados de RLS.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;
