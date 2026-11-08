# Modelo de datos

Documenta el schema real de Postgres (Supabase) y los schemas Zod
compartidos en `packages/shared` que lo espejan del lado de TypeScript.
Fuente de verdad del SQL: [supabase/migrations/](../supabase/migrations/).

Ninguna tabla de este documento tiene RLS activo — todas se leen/escriben
exclusivamente a través del backend NestJS (service role). Las tablas que
sí necesitan RLS (por acceso directo del cliente vía Realtime — chat,
notificaciones) se documentan aparte en
[chat-realtime.md](./chat-realtime.md), no acá.

## Diagrama de relaciones

```
universities ──< panels ──< communities ──< posts ──< comments (anidado, parent_id)
                              │           │           │
                  community_moderators (community_id, user_id) │
     profiles ──< (autor de communities/posts/comments)   │
                                          │           │
                              post_votes ─┘  comment_votes ─┘
                                          │           │
                                  reports (post_id XOR comment_id)
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
| `username` | text, unique | único **globalmente**, no por universidad — apodo fijo tipo Reddit |
| `university_id` | uuid, FK → `universities.id` | |
| `role` | text, default `'user'` | `check (role in ('user', 'admin'))` — rol **global** de plataforma |
| `created_at` | timestamptz | |

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

| Vista | Dónde | Qué trae |
|---|---|---|
| `profileSchema` | `/auth/me`, completar registro | perfil completo, incluido `role` |
| `publicProfileSchema` | `GET /profiles/:id` | `id`, `username`, `university`, `createdAt` — sin `role` |
| `authorSchema` | `author` de posts y comentarios | `id`, `username`, `university` |

`university` es `universitySummarySchema`: `id`, `slug`, `name` (sin el
dominio de correo).

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
| `slug` | text | único **por panel** (`unique(panel_id, slug)`), no globalmente |
| `name` | text | |
| `created_by` | uuid, FK → `profiles.id` | |
| `created_at` | timestamptz | |

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

**Permisos sobre la comunidad**: editarla/borrarla (y, con el flujo de
moderación, borrar posts/comentarios ajenos y ver sus reportes) lo puede
hacer un moderador de esa comunidad o un admin — no depende de `created_by`,
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

**Contadores desnormalizados (`score`, `comment_count`)**: los mantienen
triggers sobre `post_votes` y `comments`, en la misma transacción que el
voto o comentario — no se desincronizan y no hace falta contar en cada
lectura del feed. La fuente de verdad sigue siendo `post_votes`/`comments`:
el backfill de la migración `feed_counters_hot_and_soft_delete` sirve para
recalcularlos desde cero. `score` es también el insumo del trending.

Ver [datos-y-trending.md](./datos-y-trending.md) para la fórmula de
`hot` y por qué es una columna generada en vez de un job de BullMQ.

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
| `deleted_at` | timestamptz, nullable | borrado lógico |
| `created_at` | timestamptz | |

**Borrado lógico**: borrar un comentario solo setea `deleted_at`. Con un
`delete` real, el `on delete cascade` de `parent_id` se llevaba todas las
respuestas del hilo. Un comentario borrado conserva su lugar en el árbol,
la API lo devuelve sin autor ni texto (la app lo muestra como
"[eliminado]"), y no se puede editar, votar ni responder. El texto queda
en la base para poder revisar reportes.

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
| `created_at` | timestamptz | |

Constraint `reports_exactly_one_target`: exige que **exactamente uno** de
`post_id`/`comment_id` esté presente (XOR a nivel de base de datos).

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

**Pendiente para la rama de moderación**: número de caso y estado del
reporte ("en revisión", "se eliminó", "quedó sin acción"). Hoy resolver un
reporte **lo borra** (`DELETE /reports/:id`), así que no hay dónde guardar
cómo quedó ni a quién avisarle; eso requiere un `status` en vez de borrar,
quién lo resolvió y las notificaciones. Hasta entonces la app no muestra
número de caso, para no prometer un seguimiento que no existe.

## Schemas compartidos (`packages/shared`)

Cada tabla tiene un schema Zod equivalente en `packages/shared/src/`,
usado tanto por el backend (validar entrada/salida) como por el mobile
(tipar respuestas de la API):

| Archivo | Exporta |
|---|---|
| `university.ts` | `universitySchema`, `universitySummarySchema` (`id`, `slug`, `name`: lo que se muestra junto a un usuario) |
| `profile.ts` | `profileSchema` (incluye `role`), `createProfileSchema`, `authorSchema` y `publicProfileSchema` (con la universidad, sin `role`) |
| `panel.ts` | `panelSchema` |
| `community.ts` | `communitySchema`, `createCommunitySchema` |
| `post.ts` | `postSchema`, `createPostSchema`, `postViewSchema` (con `author`, `myVote` y `reportedByMe`), `postFeedQuerySchema`, `postPageSchema` |
| `comment.ts` | `commentSchema`, `createCommentSchema`, `commentViewSchema` (recursivo, con `replies`, `myVote` y `reportedByMe`) |
| `vote.ts` | `postVoteSchema`, `commentVoteSchema`, `castPostVoteSchema`, `castCommentVoteSchema` |
| `report.ts` | `REPORT_CATEGORIES`, `reportSchema`, `createReportSchema` (con `.refine()` validando el XOR de post/comment, espejando el `check` constraint de SQL; un detalle vacío se guarda como null) |

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
