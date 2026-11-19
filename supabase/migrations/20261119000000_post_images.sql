-- Imágenes en posts: una opcional por post, en Supabase Storage.
--
-- Acceso: solo el backend sube y borra (service role). El mobile manda la
-- imagen a la API junto con el post; nunca escribe en Storage directo. El
-- bucket es público para leer (la app muestra la imagen con su URL), con
-- nombres aleatorios: `<author_id>/<uuid>.<ext>`.

-- 1. Dónde está la imagen dentro del bucket (null = post sin imagen). Se
--    guarda la ruta y no la URL: la URL la arma el backend, así cambiar de
--    dominio o de bucket no obliga a migrar datos.
alter table posts add column image_path text;

-- 2. El bucket. Tamaño y tipos los valida también el backend antes de subir;
--    esto es la segunda barrera.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Sin políticas en storage.objects para este bucket: anon / authenticated
-- no pueden subir, cambiar ni borrar nada. Leer no necesita política porque
-- el bucket es público.

notify pgrst, 'reload schema';
