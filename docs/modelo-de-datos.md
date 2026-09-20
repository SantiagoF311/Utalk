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
universities ──< panels ──< forums ──< posts ──< comments (anidado, parent_id)
                                          │           │
     profiles ──< (autor de forums/posts/comments)   │
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
| `created_at` | timestamptz | |

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

## `forums`

Foros tipo subreddit, creados por usuarios, anidados dentro de un panel.

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | |
| `panel_id` | uuid, FK → `panels.id`, on delete cascade | |
| `slug` | text | único **por panel** (`unique(panel_id, slug)`), no globalmente |
| `name` | text | |
| `created_by` | uuid, FK → `profiles.id` | |
| `created_at` | timestamptz | |

**Por qué único por panel y no globalmente**: un foro "matemáticas" puede
existir de forma independiente tanto en el panel de una universidad como
en el de otra, o en el general — son entidades distintas aunque compartan
nombre.

**Regla de negocio (no expresable en SQL, vive en el backend)**: un
usuario solo puede crear un foro en el panel de su propia universidad
(`profile.university_id === panel.university_id`) o en el panel general
(`panel.university_id === null`) — no puede crear foros en el panel de
una universidad ajena. Se valida en el service de Nest que crea foros, no
en una constraint de base de datos.

## `posts`

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | |
| `forum_id` | uuid, FK → `forums.id`, on delete cascade | |
| `author_id` | uuid, FK → `profiles.id` | |
| `title` | text | |
| `body` | text | |
| `created_at` | timestamptz | |

Ver [datos-y-trending.md](./datos-y-trending.md) para el campo
`trending_score` (Opción 2) que se agregará a esta tabla cuando se
implemente el sistema de trending — no incluido en la migración inicial.

## `comments`

Comentarios anidados vía auto-referencia (`parent_id`).

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | |
| `post_id` | uuid, FK → `posts.id`, on delete cascade | |
| `parent_id` | uuid, FK → `comments.id`, nullable, on delete cascade | `null` = comentario raíz del post |
| `author_id` | uuid, FK → `profiles.id` | |
| `body` | text | |
| `created_at` | timestamptz | |

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
| `reason` | text | |
| `created_at` | timestamptz | |

Constraint `reports_exactly_one_target`: exige que **exactamente uno** de
`post_id`/`comment_id` esté presente (XOR a nivel de base de datos).

**Por qué polimórfico simple acá, a diferencia de los votos**: a
diferencia de los votos (que necesitan una constraint `unique` estricta
por usuario+target para evitar duplicados, y alto volumen de escritura),
los reportes son de bajo volumen y no requieren esa garantía de
unicidad — dos columnas nullable + un `check` constraint es más simple
que mantener dos tablas (`post_reports`, `comment_reports`) para este
caso.

## Schemas compartidos (`packages/shared`)

Cada tabla tiene un schema Zod equivalente en `packages/shared/src/`,
usado tanto por el backend (validar entrada/salida) como por el mobile
(tipar respuestas de la API):

| Archivo | Exporta |
|---|---|
| `university.ts` | `universitySchema` |
| `profile.ts` | `profileSchema`, `createProfileSchema` |
| `panel.ts` | `panelSchema` |
| `forum.ts` | `forumSchema`, `createForumSchema` |
| `post.ts` | `postSchema`, `createPostSchema` |
| `comment.ts` | `commentSchema`, `createCommentSchema` |
| `vote.ts` | `postVoteSchema`, `commentVoteSchema`, `castPostVoteSchema`, `castCommentVoteSchema` |
| `report.ts` | `reportSchema`, `createReportSchema` (con `.refine()` validando el XOR de post/comment, espejando el `check` constraint de SQL) |

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
