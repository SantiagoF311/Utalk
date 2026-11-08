-- Endurecimiento de las tablas del backend (ver docs/observabilidad.md).
--
-- El mobile usa la anon key (roles anon / authenticated) y, salvo
-- `universities`, nunca lee ni escribe tablas directo: todo pasa por el
-- backend, que usa service_role. Esos roles ya no tenían SELECT / INSERT /
-- UPDATE / DELETE en ninguna tabla del backend, pero Supabase les deja por
-- defecto TRUNCATE, TRIGGER y REFERENCES, que no usan nunca. TRUNCATE en
-- particular vacía una tabla entera y RLS no lo frena.

-- 1. Quitarles esos permisos en todas las tablas (universities conserva su
--    SELECT, que no se toca acá).
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- 2. Que las tablas nuevas tampoco los reciban. Aplica a lo que cree el rol
--    postgres (el de las migraciones).
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- 3. RLS sin políticas en las tablas del backend: segunda capa por si algún
--    día alguien les da permisos a anon / authenticated por error (sin
--    políticas, no ven ninguna fila). service_role se salta RLS, así que el
--    backend no cambia; los triggers y las funciones de búsqueda y
--    contadores corren como service_role. `universities` ya tenía RLS con su
--    política de lectura. Las tablas que el mobile lea directo (chats,
--    notificaciones por Realtime) van a necesitar RLS con políticas propias.
alter table panels enable row level security;
alter table communities enable row level security;
alter table community_moderators enable row level security;
alter table community_members enable row level security;
alter table profiles enable row level security;
alter table reserved_usernames enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table post_votes enable row level security;
alter table comment_votes enable row level security;
alter table reports enable row level security;
