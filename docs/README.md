# UTalk — Documentación de arquitectura

UTalk es una red social anónima interuniversitaria: paneles por universidad
más uno general, apodo fijo tipo Reddit, votos, comentarios anidados, chats
directos, y reportes/moderación de contenido.

Esta carpeta documenta las decisiones de **system design** tomadas para el
proyecto: qué tecnología se usa para cada problema, por qué se eligió, y qué
alternativas se descartaron y por qué.

## Índice

- [monorepo.md](./monorepo.md) — estructura del repositorio, npm workspaces, paquete compartido
- [modelo-de-datos.md](./modelo-de-datos.md) — tablas de Supabase, relaciones, y los schemas Zod compartidos que las espejan
- [arquitectura-backend.md](./arquitectura-backend.md) — organización interna de módulos NestJS: hexagonal/Clean Architecture, Entities, comunicación entre módulos
- [mobile.md](./mobile.md) — estructura de la app Expo, navegación, TanStack Query (datos y caché del cliente), errores y variables de entorno
- [backend-y-colas.md](./backend-y-colas.md) — NestJS, hosting, variables de entorno, BullMQ + Redis, notificaciones, moderación y rate limiting
- [datos-y-trending.md](./datos-y-trending.md) — Supabase/Postgres como fuente de verdad, trending (`hot`) como columna generada, contadores por trigger
- [chat-realtime.md](./chat-realtime.md) — chats 1 a 1 con Supabase Realtime y Presence
- [auth.md](./auth.md) — registro y login, verificación local del JWT, universidad por dominio de correo
- [busqueda.md](./busqueda.md) — full-text search + `pg_trgm`, cómo está implementada y por qué no se usa un motor dedicado
- [observabilidad.md](./observabilidad.md) — logging, manejo de errores, monitoreo
- [testing.md](./testing.md) — tests unitarios, fixtures, `npm run check` y CI
- [decisiones-descartadas.md](./decisiones-descartadas.md) — tecnologías evaluadas y por qué no se usan (todavía)

## Resumen del stack

| Capa | Tecnología | Rol |
|---|---|---|
| Monorepo | npm workspaces | Compartir código entre `apps/backend` y `apps/mobile` vía `packages/shared` |
| Cliente | Expo SDK 58 (React Native 0.88) | App móvil |
| Datos en el cliente | TanStack Query | Caché, paginación por cursor y reintentos de los datos de la API en el mobile |
| Backend | NestJS | API HTTP |
| Hosting backend | Fly.io | Proceso persistente 24/7 (necesario para los workers de colas) |
| Base de datos | Supabase (Postgres) | Fuente de verdad de todos los datos |
| Auth | Supabase Auth | Login sin contraseña vía código al correo institucional |
| Tiempo real | Supabase Realtime + Presence | Chats, indicadores de lectura y "escribiendo..." |
| Almacenamiento de archivos | Supabase Storage | Imágenes de posts |
| Colas de trabajo | BullMQ | Notificaciones, moderación |
| Backing store de colas / cache | Redis (Upstash, serverless) | Almacenamiento de BullMQ (y del rate limiting cuando el backend tenga más de una instancia) |
| Búsqueda | Postgres full-text search + `pg_trgm` | Buscar posts/comentarios |
| Rate limiting | `@nestjs/throttler` (en memoria; a Redis con más de una instancia) | Anti-spam a nivel de API |
| Observabilidad | Sentry + logs de Fly.io | Detección de errores en producción |
| Tipos compartidos | `packages/shared` (Zod) | Contratos de datos entre backend, mobile, y payloads de jobs |

## Principios de diseño seguidos

1. **No sobre-diseñar.** Cada pieza de infraestructura se agregó porque resolvía
   un problema concreto ya identificado, no una necesidad hipotética futura.
   Ver [decisiones-descartadas.md](./decisiones-descartadas.md) para el
   razonamiento de lo que se dejó afuera (Kafka, microservicios, Turborepo,
   Elasticsearch).
2. **Monorepo modular, no microservicios.** Un solo backend NestJS que
   internamente desacopla trabajo pesado con colas — no un ecosistema de
   servicios independientes.
3. **Postgres es siempre la fuente de verdad.** Cualquier dato en Redis
   (colas, contadores de rate limiting) es una copia derivada, reconstruible
   desde Postgres en cualquier momento.
4. **Lo síncrono nunca espera a lo asíncrono.** Una acción del usuario
   (postear, votar, mandar un mensaje) responde en cuanto su parte esencial
   se completa; el trabajo secundario (notificar, moderar, recalcular
   rankings) se resuelve después, sin bloquear al usuario.
