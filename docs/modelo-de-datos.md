# Modelo de datos

Documenta el schema real de Postgres (Supabase) y los schemas Zod
compartidos en `packages/shared` que lo espejan del lado de TypeScript.
Fuente de verdad del SQL: [supabase/migrations/](../supabase/migrations/).

**Acceso**: todas las tablas de este documento se leen y escriben
exclusivamente a través del backend NestJS (service role). El mobile (anon
key: roles `anon` / `authenticated`) no las toca directo, salvo
`universities` (solo lectura, para el registro). Eso se asegura con dos
capas (migración `harden_public_tables`):

1. **Permisos**: `anon` / `authenticated` no tienen ningún permiso sobre las
   tablas del backend, ni siquiera `TRUNCATE` / `TRIGGER` / `REFERENCES`, que
   Supabase da por defecto (y `TRUNCATE` no lo frena RLS). Tampoco pueden
   ejecutar las funciones (`search_content`, `profile_stats`): cada migración
   que crea una le quita el permiso a `PUBLIC`.
2. **RLS activo sin políticas** en todas: si algún día se les diera permiso
   por error, igual no verían ninguna fila. `service_role` se salta RLS, así
   que para el backend (y sus triggers y funciones) no cambia nada.

Al crear una tabla nueva del backend: activarle RLS (sin políticas) en su
migración. Las tablas que el cliente sí lea directo (vía Realtime) necesitan
RLS **con políticas**: hoy son `conversations` y `messages` (ver
[Chat](#chat) y [chat-realtime.md](./chat-realtime.md)) y `notifications`
(ver [Notificaciones](#notificaciones)).

## Diagrama de relaciones

```
universities ──< panels ──< communities ──< posts ──< comments (anidado, parent_id)
                              │           │           │
                  community_moderators (community_id, user_id) │
                  community_members    (community_id, user_id) │
     profiles ──< (autor de communities/posts/comments)   │
                                          │           │
                              post_votes ─┘  comment_votes ─┘
                                          │           │
                                  reports (post_id XOR comment_id)

profiles ──< conversations (user_a < user_b) ──< messages
profiles ──< user_blocks (blocker_id, blocked_id)
profiles ──< notifications >── posts
```

## `universities`

Catálogo cerrado de universidades soportadas.

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | |
| `slug` | text, unique | ej. `unal` |
| `name` | text | ej. "Universidad Nacional de Colombia" |
| `email_domain` | text, unique | ej. `unal.edu.co` — usado para inferir la universidad de un usuario a partir de su correo institucional en el registro |
| `created_at` | timestamptz | |

**Por qué es una tabla y no un valor embebido en `profiles`**: se evaluó
guardar la universidad como texto/slug plano directo en `profiles`, pero se
prefirió un catálogo dedicado — permite agregar universidades nuevas
insertando una fila (sin tocar código), centraliza la validación de
dominio de correo, y facilita listar universidades/paneles disponibles.
Ver [auth.md](./auth.md) para el flujo de inferencia de universidad por
dominio de correo.

## `profiles`

Perfil público del usuario, 1 a 1 con `auth.users` (que Supabase Auth
gestiona internamente — ahí vive el email/credenciales, no acá).

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | mismo valor que `auth.users.id` |
| `username` | text, unique | único **globalmente**, no por universidad — apodo tipo Reddit; se puede cambiar una vez cada 30 días (ver abajo) |
| `university_id` | uuid, FK → `universities.id` | |
| `role` | text, default `'user'` | `check (role in ('user', 'admin'))` — rol **global** de plataforma |
| `is_private` | boolean, default `false` | perfil privado (ver abajo) |
| `username_changed_at` | timestamptz, nullable | último cambio de apodo (null = nunca) |
| `created_at` | timestamptz | |

**Perfil público por defecto, privado si se elige** (como Reddit).
Público: cualquiera ve en el perfil sus publicaciones, comentarios y
contadores. Privado: los demás ven solo apodo, universidad y antigüedad; el
historial y los contadores solo los ve él mismo (`historyVisibleTo` en
`ProfileEntity`). Privado esconde la **lista** en el perfil, no lo publicado:
cada post se sigue viendo en su comunidad. Pedir el historial de un perfil
privado ajeno (`GET /posts?authorId=…`, `GET /comments/by-author/:id`) da
`PROFILE_PRIVATE` (403). El buscador sigue sin buscar por apodo: al historial
de alguien se llega desde un post o comentario suyo.

**Cambio de apodo** (`PATCH /profiles/me`):

- **Una vez cada 30 días** (`USERNAME_CHANGE_COOLDOWN_DAYS`; antes,
  `USERNAME_CHANGE_TOO_SOON`). Por qué un límite: que el apodo no sirva para
  escapar de lo que uno hizo (los reportes y la moderación igual van atados
  a la cuenta, no al apodo) ni para suplantar a otros cambiándose seguido.
  Por qué no fijo (como Reddit): en una app anónima tiene que haber una
  salida si alguien descubre quién está detrás de un apodo. 30 días es la
  regla de TikTok: alcanza como salida de seguridad y es lento para abusar.
- **El apodo viejo queda reservado 30 días** (tabla `reserved_usernames`):
  nadie lo puede tomar en ese tiempo, ni al cambiar el suyo ni al
  registrarse, para que no aparezca otro con tu nombre de antes. Es solo
  contra la suplantación: no hay excepción para quien lo dejó, porque la
  reserva dura lo mismo que la espera para volver a cambiar el apodo (nunca
  podría aprovecharla). Por lo mismo, la app no se lo menciona al usuario.
- **No se muestra "antes conocido como"**: rompería justamente la salida de
  seguridad.
- Las publicaciones y comentarios **pasan solos al apodo nuevo**: guardan el
  id del autor, no el apodo.

La disponibilidad se consulta con `GET /profiles/check-username/:u`
(público), tanto al registrarse como al cambiar el apodo: un apodo en uso o
reservado cuenta como tomado.

**Contadores del perfil** (votos recibidos, publicaciones, comentarios sin
los borrados): los calcula la función SQL `profile_stats` al pedir el
perfil, sin contadores mantenidos por triggers, porque el perfil se abre
poco comparado con el feed.

**Sobre `role`**: solo distingue usuarios de admins (pueden todo: crear
paneles, ver/resolver todos los reportes, moderar cualquier comunidad). Se
asigna a mano desde Supabase y nunca se acepta desde la API (no está en
`createProfileSchema`). La moderación con alcance **no** es un rol: ser
moderador de una comunidad es tener una fila en `community_moderators` (ver abajo).
No se agregó un valor `'moderator'` porque duplicaría ese dato y se
desincronizaría (alguien con `role = 'moderator'` sin filas, o al revés).
Solo tendría sentido si apareciera un "moderador global" que no sea admin.

**Regla de producto: la universidad del usuario siempre es visible.** Junto
a cada usuario (autor de un post o comentario, perfil de otro usuario) se
muestra de qué universidad es, tanto en el panel de su universidad como en
el general — saber desde qué universidad habla alguien es parte del
producto. El anonimato de UTalk es sobre la **identidad real** (nombre,
correo, carnet): el correo nunca sale del backend. Lo que tampoco se
expone a otros es el `role` — solo lo ve cada usuario en su propio perfil
(`/auth/me`).

La API siempre manda la universidad junto al autor (`authorSchema`). La
excepción visual es el **feed de un panel** en el mobile: como en Reddit, cada
tarjeta muestra solo la comunidad y hace cuánto (sin autor). Al abrir el
post (y en los comentarios) se ven el apodo y la universidad.

| Vista | Dónde | Qué trae |
|---|---|---|
| `profileSchema` | `/auth/me`, completar registro, `PATCH /profiles/me` | perfil completo, incluidos `role`, `isPrivate` y `usernameChangedAt` |
| `publicProfileSchema` | `GET /profiles/:id` (propio o ajeno) | `id`, `username`, `university`, `isPrivate`, `stats` (null si es privado y ajeno), `createdAt` — sin `role` |
| `authorSchema` | `author` de posts y comentarios | `id`, `username`, `university` |

`university` es `universitySummarySchema`: `id`, `slug`, `name` (sin el
dominio de correo).

## `reserved_usernames`

Apodos que alguien dejó al cambiar el suyo (ver `profiles`).

| columna | tipo | notas |
|---|---|---|
| `username` | text, PK | |
| `user_id` | uuid, FK → `profiles.id`, on delete cascade | de quién era (para moderación; nadie lo puede tomar mientras dure la reserva, ni siquiera él) |
| `reserved_until` | timestamptz | vencida la fecha, el apodo vuelve a estar libre (no hace falta borrar la fila) |

## `panels`

Exactamente **un panel por universidad** (constraint `unique` en
`university_id`) más **un panel general** (`university_id = null`).

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | |
| `university_id` | uuid, unique, FK → `universities.id`, nullable | `null` = panel general |
| `slug` | text, unique | |
| `name` | text | |
| `created_at` | timestamptz | |

**Nota sobre paneles especiales a futuro**: Postgres trata cada `NULL`
como distinto en una constraint `UNIQUE`, así que la tabla ya admite, sin
ninguna migración adicional, insertar más de un panel con
`university_id = null` (ej. un panel "Eventos" separado del general). Si
eso llega a pasar, identificar "el panel general" específicamente por
`slug = 'general'` en el código — nunca asumir que es "el único panel sin
universidad", porque dejaría de serlo. No se agregó un campo `type`
(`'university' | 'general' | 'special'`) todavía porque no hay un caso de
uso real hoy que lo necesite; se evaluará si ese caso aparece.

## `communities`

Comunidades tipo subreddit, creadas por usuarios, anidadas dentro de un panel.

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | |
| `panel_id` | uuid, FK → `panels.id`, on delete cascade | |
| `slug` | text | único **por panel** (`unique(panel_id, slug)`), no globalmente. Lo que va en `c/<slug>`: minúsculas, números y guion bajo, 3 a 32 (lo valida `communitySchema`) |
| `name` | text | |
| `description` | text, ≤ 300, default `''` | opcional al crear |
| `topic` | text, check | tema, para explorar por tema: `academic`, `campus_life`, `marketplace`, `events`, `sports`, `venting`, `lost_and_found`, `other` (`COMMUNITY_TOPICS` en `@utalk/shared`) |
| `member_count` | integer | contador de miembros, mantenido por trigger (ver `community_members`) |
| `created_by` | uuid, FK → `profiles.id` | |
| `created_at` | timestamptz | |

**Por qué el tema es una lista fija**: para poder filtrar por tema (chips en
la pestaña Comunidades). Cambiar la lista toca tres lugares: `COMMUNITY_TOPICS`,
el `check` de la columna y los nombres en español del mobile
(`lib/communityTopics.ts`).

**Por qué único por panel y no globalmente**: una comunidad "matemáticas" puede
existir de forma independiente tanto en el panel de una universidad como
en el de otra, o en el general — son entidades distintas aunque compartan
nombre.

**Regla de negocio (no expresable en SQL, vive en el backend)**: un
usuario solo puede **crear comunidades y postear** en el panel de su propia
universidad (`profile.university_id === panel.university_id`) o en un
panel sin universidad (`panel.university_id === null`: el general, o uno
especial a futuro). **Leer, comentar y votar** es libre en cualquier
panel — ver lo que pasa en otras universidades es parte del producto,
pero lo que se publica en el panel de una universidad lo publican sus
estudiantes verificados. Vive en `PanelEntity.acceptsPostsFrom()`, usado
por los services que crean comunidades y posts.

**Permisos sobre la comunidad**: editarla/borrarla, ver la cola de reportes
de su contenido y eliminar posts/comentarios reportados (ver
[Moderación](#moderación)) lo puede hacer un moderador de esa comunidad o un
admin — no depende de `created_by`,
que queda como dato histórico.

## `community_moderators`

Moderadores por comunidad, tipo mods de un subreddit.

| columna | tipo | notas |
|---|---|---|
| `community_id` | uuid, FK → `communities.id`, on delete cascade | |
| `user_id` | uuid, FK → `profiles.id`, on delete cascade | |
| `created_at` | timestamptz | |

Clave primaria compuesta `(community_id, user_id)`.

**El creador es el primer moderador**: el trigger
`communities_add_creator_as_moderator` inserta la fila al crear la comunidad. Se
hace con trigger y no con dos inserts desde el backend para que sea
atómico (el cliente de Supabase no maneja transacciones). Que sea una
fila y no un permiso implícito de `created_by` permite que el creador
renuncie o pase la comunidad a otro.

**Por qué por comunidad y no por panel**: los paneles son fijos (uno por
universidad + general) y funcionan como "la plataforma"; las comunidades son
las que crean los usuarios, y todo el contenido moderable
(posts, comentarios) vive dentro de una. Una comunidad que se queda sin mods la
siguen cubriendo los admins.

## `community_members`

Quién se unió a qué comunidad ("Unirse" / "Tus comunidades").

| columna | tipo | notas |
|---|---|---|
| `community_id` | uuid, FK → `communities.id`, on delete cascade | |
| `user_id` | uuid, FK → `profiles.id`, on delete cascade | índice propio, para "las comunidades de un usuario" |
| `created_at` | timestamptz | |

Clave primaria compuesta `(community_id, user_id)`.

**Triggers**:

- `community_members_apply_count`: suma o resta en `communities.member_count`
  al unirse o salirse. Contador en vez de `count(*)` porque se muestra en
  cada lista de comunidades (mismo criterio que `comment_count` en posts).
- `communities_add_creator_as_member`: quien crea una comunidad queda unido
  (además de moderador). Por eso, al crear, el backend relee la comunidad:
  la fila que devuelve el insert es de antes de que el trigger sume al
  creador.

**Reglas** (en `CommunitiesService`):

- **Unirse es seguir**, así que se puede en cualquier panel (leer es libre),
  aunque publicar no.
- **Salirse no quita la moderación**: son tablas distintas, y un moderador
  puede dejar de seguir una comunidad sin dejar de moderarla.
- **Unirse y salirse son idempotentes** (`PUT` / `DELETE
  /communities/:id/membership`): unirse dos veces o salirse sin estar no son
  errores, porque el botón de la app se puede tocar varias veces seguidas.

Las vistas de comunidad traen `joinedByMe` (se calcula como `myVote`: una
consulta con los ids de lo que se muestra).

## `posts`

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | |
| `community_id` | uuid, FK → `communities.id`, on delete cascade | |
| `author_id` | uuid, FK → `profiles.id` | |
| `title` | text | |
| `body` | text | |
| `score` | integer, default 0 | suma de `post_votes.value` — mantenido por trigger |
| `comment_count` | integer, default 0 | cantidad de comentarios (incluye borrados lógicos) — mantenido por trigger |
| `hot` | double precision, generada | `hot_score(score, created_at)`: fórmula hot de Reddit, la recalcula Postgres al cambiar `score` |
| `created_at` | timestamptz | |
| `removed_at` | timestamptz, nullable | eliminado por moderación (ver [`reports`](#reports)) |
| `removed_by` | uuid, FK → `profiles.id`, nullable, on delete set null | el moderador o admin que lo eliminó |
| `image_path` | text, nullable | ruta de su imagen en el bucket `post-images` (`<author_id>/<uuid>.<ext>`); null = sin imagen. Ver [Imágenes de posts](#imágenes-de-posts-supabase-storage) |

**Eliminado por moderación**: un post con `removed_at` deja de existir para
todos. No aparece en ningún feed, la búsqueda ni los contadores del perfil
(`profile_stats`), y los comentarios de su autor en esa publicación salen de
su perfil. Abrirlo da `POST_REMOVED` (410), y lo mismo pasa al comentarlo,
votarlo o reportarlo: `PostsService.findById` lo rechaza, así que todos los
módulos que lo usan quedan cubiertos. La moderación lo sigue leyendo con
`findByIdIncludingRemoved`. La fila no se borra, para no perder sus reportes
(que se borrarían en cascada) ni el historial.

A diferencia de los comentarios, el autor **sí borra su post de verdad**
(`delete`), y eso se lleva sus reportes. Ver "Pendiente" en
[`reports`](#reports).

**Contadores desnormalizados (`score`, `comment_count`)**: los mantienen
triggers sobre `post_votes` y `comments`, en la misma transacción que el
voto o comentario — no se desincronizan y no hace falta contar en cada
lectura del feed. La fuente de verdad sigue siendo `post_votes`/`comments`:
el backfill de la migración `feed_counters_hot_and_soft_delete` sirve para
recalcularlos desde cero. `score` es también el insumo del trending.

Ver [datos-y-trending.md](./datos-y-trending.md) para la fórmula de
`hot` y por qué es una columna generada en vez de un job de BullMQ.

### Imágenes de posts (Supabase Storage)

Un post puede llevar **una** imagen opcional (el texto sigue siendo
obligatorio). Viven en el bucket **`post-images`** de Supabase Storage,
creado por la migración `post_images`.

- **Solo el backend sube y borra** (service role), detrás del puerto
  `PostImageStorage` (`modules/posts/domain/postImage.storage.ts`). El
  mobile manda la imagen en el mismo `POST /posts`, como multipart
  (campo `image`, `POST_IMAGE_FIELD`), y nunca escribe en Storage directo:
  `storage.objects` no tiene políticas para este bucket, así que `anon` /
  `authenticated` no pueden subir, cambiar ni borrar.
- **Bucket público para leer**: la app muestra la imagen con la URL que
  arma el backend (`imageUrl` en la vista del post). Se guarda la **ruta**,
  no la URL, para poder cambiar de dominio o de bucket sin migrar datos.
  Las rutas llevan un uuid (`<author_id>/<uuid>.<ext>`), así que no se
  pueden adivinar, pero quien tenga el link la ve aunque no tenga sesión.
  La alternativa privada (URLs firmadas que vencen) es más segura pero
  rompe el caché de las imágenes en el celular; se descartó por ahora.
- **Validación, en dos barreras**: el backend corta la subida en 5 MB
  (`POST_IMAGE_MAX_BYTES`, 413 `PAYLOAD_TOO_LARGE`) y mira los **primeros
  bytes** del archivo (`detectImageType`): solo acepta JPEG, PNG y WebP
  (`INVALID_IMAGE` si no), sin importar el nombre ni el Content-Type que
  manda el cliente. El bucket repite el límite de tamaño y de tipos.
- **Orden al publicar**: primero se valida el archivo, después se
  comprueba que la persona pueda publicar en ese panel, recién ahí se sube
  la imagen, y por último se guarda el post. Si guardar falla, se borra la
  imagen recién subida.
- **La imagen se va con el post**: al borrar el post (su autor) o al
  eliminarlo la moderación, se borra también del bucket. Importa sobre
  todo para fotos que exponen a alguien. Si el bucket falla al borrar, la
  acción igual se completa y el error queda en el log (queda un archivo
  huérfano, no un error para el usuario). Eliminar un **comentario** no
  toca la imagen de su post.
- Editar un post no cambia su imagen (solo título y texto).

**Feed paginado por cursor**: `GET /posts?communityId|panelId&sort=hot|new|top` (default `hot`)
pagina por cursor (no por número de página), ordenando por
`(hot, id)`, `(created_at, id)` o `(score, id)` — con un índice compuesto para cada uno.
Con páginas numeradas, los posts nuevos que entran mientras el usuario
hace scroll correrían todo y se verían repetidos. En "hot" y "top" el valor puede
cambiar entre páginas, así que un post puede repetirse o saltarse
ocasionalmente; se acepta.

## `comments`

Comentarios anidados vía auto-referencia (`parent_id`).

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | |
| `post_id` | uuid, FK → `posts.id`, on delete cascade | |
| `parent_id` | uuid, FK → `comments.id`, nullable, on delete cascade | `null` = comentario raíz del post |
| `author_id` | uuid, FK → `profiles.id` | |
| `body` | text | |
| `score` | integer, default 0 | suma de `comment_votes.value` — mantenido por trigger |
| `deleted_at` | timestamptz, nullable | borrado lógico (por su autor o por moderación) |
| `created_at` | timestamptz | |
| `removed_at` | timestamptz, nullable | eliminado por moderación |
| `removed_by` | uuid, FK → `profiles.id`, nullable, on delete set null | el moderador o admin que lo eliminó |

**Borrado lógico**: borrar un comentario solo setea `deleted_at`. Con un
`delete` real, el `on delete cascade` de `parent_id` se llevaba todas las
respuestas del hilo. Un comentario borrado conserva su lugar en el árbol,
la API lo devuelve sin autor ni texto (la app lo muestra como
"[eliminado]"), y no se puede editar, votar ni responder. El texto queda
en la base para poder revisar reportes.

**Eliminado por moderación**: setea `removed_at` **y también**
`deleted_at`. Así todo lo que ya trata los borrados (el árbol, los
comentarios del perfil, la búsqueda, `profile_stats` y no dejar editar,
votar ni responder) vale sin cambios, y `removed_at` solo dice por qué se
borró: la vista trae `isRemoved` y la app muestra "Un moderador eliminó este
comentario". Como cualquier borrado, sigue contando en `posts.comment_count`.

**Árbol**: el backend trae todos los comentarios del post en una sola
consulta (`parent_id` simple, sin closure table ni `WITH RECURSIVE`) y
arma el árbol en memoria — un post universitario no tiene miles de
comentarios. Si eso cambiara, el paso siguiente sería paginar los
comentarios raíz y cargar respuestas profundas a demanda.

## `post_votes` / `comment_votes`

Tablas **separadas** para votos de posts y de comentarios (no una tabla
polimórfica única).

| columna | tipo | notas |
|---|---|---|
| `post_id` / `comment_id` | uuid, FK, on delete cascade | |
| `user_id` | uuid, FK → `profiles.id`, on delete cascade | |
| `value` | smallint | `check (value in (-1, 1))` |
| `created_at` | timestamptz | |

Clave primaria compuesta `(post_id, user_id)` / `(comment_id, user_id)` —
evita votos duplicados del mismo usuario sin necesitar un índice `unique`
aparte.

**Por qué tablas separadas y no una tabla `votes` polimórfica
(`target_type` + `target_id`)**:
- Una FK real (`post_id references posts(id)`) es posible; con una columna
  polimórfica, Postgres no puede validar que `target_id` apunte a la
  tabla correcta según `target_type` — quedaría sin garantía de
  integridad referencial.
- Los índices y la clave primaria compuesta son más simples y directos.
- El costo (algo de repetición entre las dos tablas) es bajo porque la
  lógica de votar es simple y no diverge mucho entre posts y comentarios.

## `reports`

Reporte de moderación sobre un post **o** un comentario (nunca ambos).

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | |
| `post_id` | uuid, FK → `posts.id`, nullable, on delete cascade | |
| `comment_id` | uuid, FK → `comments.id`, nullable, on delete cascade | |
| `reported_by` | uuid, FK → `profiles.id` | |
| `category` | text, check | motivo: `exposes_person`, `threat`, `harassment`, `spam`, `other` (`REPORT_CATEGORIES` en `@utalk/shared`) |
| `reason` | text, nullable | detalle opcional que escribe quien reporta (hasta 500 caracteres) |
| `status` | text, check, default `'pending'` | `pending` (en revisión), `removed` (se eliminó el contenido), `dismissed` (sin acción) — `REPORT_STATUSES` en `@utalk/shared` |
| `resolved_by` | uuid, FK → `profiles.id`, nullable, on delete set null | quién lo resolvió (no se le muestra a quien reportó) |
| `resolved_at` | timestamptz, nullable | null mientras está pendiente (check `reports_resolved_when_not_pending`) |
| `case_number` | bigint, identity, unique | número legible para quien reportó ("caso #42") |
| `created_at` | timestamptz | |

Constraint `reports_exactly_one_target`: exige que **exactamente uno** de
`post_id`/`comment_id` esté presente (XOR a nivel de base de datos).

Índices: `reports_pending` (parcial, solo pendientes: la cola) y
`reports_by_reporter` (`reported_by, created_at desc`: "Mis reportes").

**Por qué el motivo es una lista fija y no texto libre**: para que la
moderación pueda filtrar y priorizar. Una amenaza o un post que expone a
alguien (nombre, salón, horario) no deberían esperar en la misma fila que
el spam; con texto libre no hay forma de distinguirlos sin leer cada uno.
El texto libre queda como detalle opcional.

**Reglas** (en `ReportsService`):

- **Un reporte por persona y contenido** (`ALREADY_REPORTED`, 409):
  reportar diez veces lo mismo no lo vuelve más urgente y llenaría la cola.
  El service lo revisa antes de insertar, y dos índices únicos parciales lo
  garantizan si llegan dos reportes al mismo tiempo:
  `reports_one_per_post_and_reporter` (`reported_by, post_id` donde
  `post_id` no es null) y `reports_one_per_comment_and_reporter` (igual con
  `comment_id`). Son parciales porque en cada fila uno de los dos targets es
  null.
- **No se reporta lo propio** (`CANNOT_REPORT_OWN_CONTENT`, 403): para eso
  está borrarlo. La regla vive en `isAuthoredBy` de las entidades de post y
  comentario.

**Oculto para quien reportó**: las vistas de post y comentario traen
`reportedByMe` (se calcula como `myVote`: una consulta por página con los ids
de lo que se muestra). La app muestra ese contenido oculto, con "Ver igual";
para el resto no cambia nada.

**Por qué polimórfico simple acá, a diferencia de los votos**: los votos
tienen alto volumen de escritura y su lógica es la mitad del producto; los
reportes son de bajo volumen. Dos columnas nullable + un `check` constraint
(y los dos índices únicos parciales) es más simple que mantener dos tablas
(`post_reports`, `comment_reports`) para este caso.

### Moderación

Los reportes no se borran ni se editan: cambian de estado cuando la
moderación resuelve el contenido. Así queda el historial y quien reportó
puede ver en qué quedó (`GET /reports/mine`, "Mis reportes" en la app, con
el número de caso).

**Quién modera**: un moderador de la comunidad (`community_moderators`) o un
admin. Es el mismo `CommunitiesService.canModerate()` que se usa para editar
la comunidad; para un comentario cuenta la comunidad de su post.

**Se modera el contenido, no cada reporte**: si tres personas reportan el
mismo post, la cola muestra una sola entrada ("3 reportes · acoso · expone a
una persona") y el moderador decide una vez:

- **Eliminar** (`remove`): sus reportes pendientes pasan a `removed` y el
  contenido queda eliminado por moderación (`removed_at`). Si es un post,
  también se cierran como `removed` los reportes pendientes de sus
  comentarios, que desaparecen con él.
- **Dejar** (`dismiss`): sus reportes pendientes pasan a `dismissed` y el
  contenido sigue igual.

Resolver contenido sin reportes pendientes da `NO_PENDING_REPORTS` (409).
Pasa cuando otro moderador se adelantó, y el contenido no se toca sin un
reporte que lo justifique.

**Dos funciones SQL** (migración `moderation`; sin `EXECUTE` para `PUBLIC`,
solo `service_role`):

- `moderation_queue(p_community_ids)`: los reportes pendientes agrupados por
  contenido, con la cantidad, los motivos, los detalles y la fecha del
  primero y del último. `null` = todas las comunidades (admins). Para un
  comentario, `post_id` es el de su post, para poder abrirlo desde la cola.
- `resolve_reports(p_post_id, p_comment_id, p_action, p_resolved_by)`:
  cierra los reportes y elimina el contenido en **una sola transacción**
  (el cliente de Supabase no maneja transacciones; mismo motivo que los
  triggers). Devuelve cuántos reportes cerró.

**Orden de la cola** (regla de dominio en `ModerationCaseEntity`, no en
SQL): primero lo más grave según el motivo más grave de sus reportes
(amenazas y lo que expone a alguien; después acoso; después el resto) y, a
igual gravedad, lo que lleva más tiempo esperando.

**Avisos**: al resolver, se avisa a cada persona que reportó ese contenido
(su número de caso y en qué quedó) y, si se eliminó, a su autor, sin decirle
quién lo reportó. Los crea el worker de BullMQ (ver
[Notificaciones](#notificaciones)). Quien reportó lo ve además en "Mis
reportes".

**Pendiente**:

- **El autor que borra su post reportado borra los reportes**: el autor
  borra su post de verdad, y el `on delete cascade` de `reports.post_id` se
  lleva sus reportes (se pierde la evidencia y el caso desaparece de "Mis
  reportes"). Arreglarlo es que borrar un post también sea lógico.
- **Agregar o quitar moderadores** de una comunidad: hoy solo existe el
  creador (por trigger).

## Chat

Diseño, reglas y tiempo real en [chat-realtime.md](./chat-realtime.md).
**Acceso distinto al resto**: `conversations` y `messages` las lee el mobile
directo por Realtime, así que tienen RLS **con políticas** de `SELECT` para
quien participa (y `SELECT` para `authenticated`, sin permisos de
escritura). `user_blocks` es como el resto: solo backend, RLS sin
políticas.

### `conversations`

Una por par de usuarios.

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | |
| `user_a` | uuid, FK → `profiles.id`, on delete cascade | el menor de los dos ids |
| `user_b` | uuid, FK → `profiles.id`, on delete cascade | el mayor (índice propio, para "mis conversaciones") |
| `initiated_by` | uuid, FK → `profiles.id`, on delete cascade | quien escribió primero; check: es `user_a` o `user_b` |
| `accepted_at` | timestamptz, nullable | null = solicitud sin aceptar |
| `last_message_at` | timestamptz | fecha del último mensaje, mantenida por trigger (`messages_touch_conversation`); ordena la lista |
| `created_at` | timestamptz | |

**Pares ordenados** (`conversations_users_ordered`: `user_a < user_b`, y
unique `conversations_one_per_pair`): así (A, B) y (B, A) son la misma fila
y no puede haber dos conversaciones entre las mismas personas. Si dos
primeros mensajes llegan a la vez, el unique frena al segundo.

### `messages`

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | |
| `conversation_id` | uuid, FK → `conversations.id`, on delete cascade | |
| `sender_id` | uuid, FK → `profiles.id`, on delete cascade | |
| `body` | text | 1 a 2000 caracteres (check; `MESSAGE_MAX_LENGTH` en `@utalk/shared`) |
| `read_at` | timestamptz, nullable | cuándo lo leyó el otro ("Visto") |
| `created_at` | timestamptz | |

Índices: `messages_by_conversation` (`conversation_id, created_at desc, id
desc`: historial paginado por cursor) y `messages_unread` (parcial, `read_at
is null`: los no leídos).

### `user_blocks`

| columna | tipo | notas |
|---|---|---|
| `blocker_id` | uuid, FK → `profiles.id`, on delete cascade | quien bloquea |
| `blocked_id` | uuid, FK → `profiles.id`, on delete cascade | a quién; check: no a sí mismo |
| `created_at` | timestamptz | |

Clave primaria compuesta `(blocker_id, blocked_id)`. Un bloqueo corta los
mensajes en los dos sentidos (regla en `BlocksService` / `ChatService`).

### Funciones

Solo `service_role` las ejecuta.

- `start_conversation(p_sender, p_recipient, p_body)`: crea la conversación
  (con el par ordenado) y su primer mensaje en una sola transacción, para
  que no quede una conversación vacía si el mensaje falla.
- `conversation_summaries(p_user_id, p_conversation_id)`: las conversaciones
  de un usuario con la otra persona (apodo y universidad), el último mensaje,
  cuántos no leyó y si hay un bloqueo (`blocked_by_me`, `blocked_by_other`).
  Las conversaciones con bloqueo no se ocultan (ver
  [chat-realtime.md](./chat-realtime.md#bloqueo)). Con `p_conversation_id`,
  una sola (el detalle). Versión actual en la migración
  `chat_blocked_conversations_visible`, que la borra y la vuelve a crear
  porque cambió lo que devuelve.

## Notificaciones

Avisos dentro de la app (la campana de Inicio). Tres tipos
(`NOTIFICATION_TYPES` en `@utalk/shared`):

| `type` | Para quién | Cuándo |
|---|---|---|
| `new_post_in_community` | cada miembro de la comunidad (salvo el autor y quien lo bloqueó) | alguien publicó en una comunidad a la que te uniste |
| `report_resolved` | cada persona que reportó el contenido | un moderador lo resolvió: dice el número de caso y si se eliminó o se dejó |
| `content_removed` | el autor | un moderador eliminó su publicación o su comentario. No dice quién lo reportó |

Las crea el worker de BullMQ, nunca el request que crea el post o que
resuelve el reporte (ver [backend-y-colas.md](./backend-y-colas.md)).
**Acceso como el chat**: el
mobile las lee directo por Realtime para enterarse de las nuevas, así que
`notifications` tiene RLS **con una política** de `SELECT` para su
destinatario (y `SELECT` para `authenticated`, sin permisos de escritura).
Marcarlas como leídas va por la API.

### `notifications`

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → `profiles.id`, on delete cascade | el destinatario |
| `type` | text | check: uno de los tres de arriba |
| `post_id` | uuid, FK → `posts.id`, on delete cascade | el post del que avisa (en un comentario, el post donde está); si el autor lo borra, la notificación se va con él |
| `comment_id` | uuid, FK → `comments.id`, nullable, on delete cascade | solo en los avisos de moderación sobre un comentario; null = sobre el post |
| `report_id` | uuid, FK → `reports.id`, nullable, on delete cascade | solo en `report_resolved` (check `notifications_report_only_when_resolved`: lo tiene ese tipo y ningún otro) |
| `read_at` | timestamptz, nullable | null = sin leer |
| `created_at` | timestamptz | |

**Idempotencia, un unique por tipo** (índices parciales): es lo que hace
que un reintento del job no duplique avisos, porque las funciones insertan
con `on conflict do nothing`.

- `notifications_one_new_post`: `(user_id, post_id)` en los de post nuevo.
- `notifications_one_per_report`: `(report_id)` en los de reporte. No
  sirve uno por post: alguien puede haber reportado dos comentarios del
  mismo post.
- `notifications_one_removal`: `(post_id, comment_id)` con `nulls not
  distinct` en los de contenido eliminado, para que "el post" (comment_id
  null) también cuente una sola vez.

Otros índices: `notifications_by_user` (`user_id, created_at desc, id
desc`: la lista) y `notifications_unread` (parcial, `read_at is null`: el
contador de la campana).

**Qué se muestra**: un aviso de post nuevo no aparece (ni cuenta en la
campana) si el post se eliminó por moderación. Los de moderación,
justamente en ese caso, sí. La fila queda en la tabla igual.

### Funciones

Solo `service_role` las ejecuta.

- `notify_new_post(p_post_id)`: una notificación por cada miembro de la
  comunidad del post (`community_members`), salvo el autor y quien lo
  bloqueó (`user_blocks`). Un post ya eliminado por moderación no notifica.
  Devuelve cuántas creó (0 en un reintento).
- `notify_moderation_result(p_post_id, p_comment_id)`: los avisos de una
  resolución (exactamente uno de los dos ids). Mira lo ya guardado:
  - un `report_resolved` por cada reporte cerrado de ese contenido, y si
    se eliminó un post, también por los de sus comentarios
    (`resolve_reports` los cierra con él);
  - un `content_removed` para el autor, si el contenido quedó eliminado.

  Devuelve cuántas creó. Como mira el estado guardado, un reporte que se
  cerró antes de que existieran estos avisos recibe el suyo recién si el
  mismo contenido se vuelve a resolver (por reportes nuevos sobre algo que
  se dejó).
- `notification_list(p_user_id, p_limit)` y `unread_notification_count(p_user_id)`:
  la lista (con el título del post, su comunidad y, en los de reporte, el
  número de caso y en qué quedó) y el contador de la campana. Son
  funciones y no consultas de PostgREST porque el filtro "ocultar los de
  post nuevo si el post se eliminó, pero no los de moderación" depende del
  tipo, y eso no se puede expresar con los filtros de supabase-js.

## Schemas compartidos (`packages/shared`)

Cada tabla tiene un schema Zod equivalente en `packages/shared/src/`,
usado tanto por el backend (validar entrada/salida) como por el mobile
(tipar respuestas de la API):

| Archivo | Exporta |
|---|---|
| `university.ts` | `universitySchema`, `universitySummarySchema` (`id`, `slug`, `name`: lo que se muestra junto a un usuario) |
| `profile.ts` | `profileSchema` (incluye `role`, `isPrivate`, `usernameChangedAt`), `createProfileSchema`, `updateMyProfileSchema`, `authorSchema`, `profileStatsSchema` y `publicProfileSchema` (con la universidad y los contadores, sin `role`); `USERNAME_CHANGE_COOLDOWN_DAYS` |
| `panel.ts` | `panelSchema` |
| `community.ts` | `COMMUNITY_TOPICS`, `communitySchema`, `communityViewSchema` (con `joinedByMe`), `createCommunitySchema`, `updateCommunitySchema` |
| `post.ts` | `postSchema`, `createPostSchema`, `postViewSchema` (con `author`, `myVote`, `reportedByMe` e `imageUrl`), `postFeedQuerySchema` (por comunidad, panel o autor), `postPageSchema`; `POST_IMAGE_FIELD`, `POST_IMAGE_MAX_BYTES`, `POST_IMAGE_TYPES` |
| `comment.ts` | `commentSchema`, `createCommentSchema`, `commentViewSchema` (recursivo, con `replies`, `myVote`, `reportedByMe` e `isRemoved`), `profileCommentSchema` y `profileCommentPageSchema` (comentarios de un autor, con el título de su post) |
| `vote.ts` | `postVoteSchema`, `commentVoteSchema`, `castPostVoteSchema`, `castCommentVoteSchema` |
| `report.ts` | `REPORT_CATEGORIES`, `REPORT_STATUSES`, `reportSchema` (con `caseNumber`, `status` y `resolvedAt`), `createReportSchema` (con `.refine()` validando el XOR de post/comment, espejando el `check` constraint de SQL; un detalle vacío se guarda como null), `myReportSchema` (un reporte en "Mis reportes", con el título de la publicación) |
| `moderation.ts` | `moderationScopeSchema` (si es admin y qué comunidades modera), `moderationQueueQuerySchema`, `moderationCaseSchema` (un contenido con sus reportes pendientes), `MODERATION_ACTIONS`, `resolveReportsSchema`, `resolveReportsResultSchema` |
| `chat.ts` | `MESSAGE_MAX_LENGTH`, `messageViewSchema` (con `senderId`, misma forma que la fila de Realtime), `CONVERSATION_STATUSES`, `conversationViewSchema` (con `otherUser`, `status` para quien mira, último mensaje, `unreadCount`, `blockedByMe` y `blockedByOther`), `startConversationSchema`, `startConversationResultSchema`, `sendMessageSchema`, `messagePageQuerySchema`, `messagePageSchema` |
| `block.ts` | `blockedUserSchema` (alguien que bloqueaste, para Ajustes) |
| `notification.ts` | `NOTIFICATION_TYPES`, `NOTIFICATIONS_LIMIT`, `notificationSchema` (unión discriminada por `type`: todas con el `post` y su `community`; las de moderación además con `target` y, la de reporte, `report`), `unreadNotificationCountSchema`, `notifySubscribersJobSchema` y `notifyModerationResultJobSchema` (payloads de los jobs de BullMQ) |

**Convención seguida**: cada dominio tiene un schema de la fila completa
(ej. `profileSchema`, representa la tabla tal cual) y, cuando aplica, un
schema `create*`/`cast*` acotado solo a los campos que el cliente puede
enviar al crear/mutar ese recurso — nunca se mezclan ambas formas en un
solo schema con campos opcionales.

**Sobre representar joins**: un schema de fila (ej. `profileSchema`) solo
tiene el `id` de sus relaciones (ej. `universityId`), no el objeto
completo embebido — porque así es como vive la fila real en la tabla. Si
en el futuro un endpoint necesita el resultado de un join (ej. un perfil
con su universidad resuelta), se define un schema derivado aparte (ej.
`profileWithUniversitySchema`, extendiendo `profileSchema` con
`university: universitySchema`) en vez de mezclar ambas formas en el
schema base.
