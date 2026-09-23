-- El catálogo de universidades no es sensible (son nombres y dominios de
-- correo ya públicos) y la pantalla de registro necesita leerlo desde el
-- mobile para mostrar si el dominio ingresado está soportado, antes de
-- intentar el registro. RLS de solo lectura para todos.
alter table universities enable row level security;

create policy "universities are publicly readable"
on universities
for select
to anon, authenticated
using (true);
