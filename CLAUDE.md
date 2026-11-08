# UTalk

Red social anónima interuniversitaria: paneles por universidad + uno
general, apodo tipo Reddit (cambiable cada 30 días), votos, comentarios anidados, chats,
reportes/moderación.

## Arquitectura

La arquitectura completa (stack, decisiones y por qué se descartó cada
alternativa) está documentada en [docs/](docs/README.md). Leer esa carpeta
antes de proponer o agregar cualquier tecnología nueva — la mayoría de las
alternativas obvias (Kafka, microservicios, Turborepo, Elasticsearch,
Render, Oracle Cloud) ya fueron evaluadas y descartadas con una razón
concreta, documentada en [docs/decisiones-descartadas.md](docs/decisiones-descartadas.md).

Resumen rápido: monorepo npm workspaces · NestJS en Fly.io · Supabase
(Postgres + Auth + Realtime + Storage) · BullMQ + Redis (Upstash) para
trabajos async (notificaciones, moderación) · Postgres full-text
search + `pg_trgm` para búsqueda · Sentry + logs de Fly.io para
observabilidad.

## Estructura del monorepo

```
apps/backend/     NestJS (API)
apps/mobile/       Expo / React Native
packages/shared/  @utalk/shared — tipos y schemas compartidos (Zod)
```

## Reglas del monorepo (npm workspaces)

- **Instalar dependencias siempre desde la raíz**: `npm install`. Nunca
  correr `npm install` dentro de `apps/backend/` o `apps/mobile/` por
  separado — rompe el enlace del workspace y duplica dependencias.
- **Agregar una dependencia a un workspace específico**:
  `npm install <paquete> -w apps/mobile` (o `-w apps/backend`,
  `-w packages/shared`).
- Detalle completo del comportamiento de hoisting/resolución en
  [docs/monorepo.md](docs/monorepo.md).

## Estructura de módulos del backend

Cada módulo de dominio en `apps/backend/src/modules/` sigue arquitectura
hexagonal/Clean Architecture simplificada — **nunca** escribir un
`*.controller.ts`/`*.service.ts` plano que llame a Supabase directo.
Estructura obligatoria por módulo:

```
modules/<dominio>/
├── domain/
│   ├── <dominio>.entity.ts        # clase con métodos, no un tipo plano
│   └── <dominio>.repository.ts     # el puerto: interface, sin implementación
├── infrastructure/
│   └── supabase-<dominio>.repository.ts  # el adaptador: implementa el puerto
├── <dominio>.service.ts            # casos de uso, inyecta el puerto (no Supabase directo)
├── <dominio>.view.ts               # entidad → respuesta de la API (nunca se devuelve la entidad)
├── <dominio>.controller.ts
└── <dominio>.module.ts
```

Regla no negociable: el código en `domain/` nunca importa nada de
`infrastructure/` ni de `@supabase/supabase-js` — el `service` depende
del puerto (`interface`), nunca de la implementación concreta. Cuando un
módulo necesita un dato de otro dentro del mismo request, se inyecta
directo (patrón estándar de Nest) — no eventos genéricos, no colas (las
colas de BullMQ son solo para lo ya definido como async: notificaciones,
moderación).

Detalle completo, con ejemplo de código de punta a punta, en
[docs/arquitectura-backend.md](docs/arquitectura-backend.md) — leer antes
de crear el primer módulo o cualquier módulo nuevo.

## Tipos y contratos compartidos

Cualquier tipo o schema de dominio usado por más de un workspace (backend,
mobile, o los payloads de jobs de BullMQ) va en `packages/shared`, definido
con Zod — no duplicar tipos entre apps.

## Mantener la documentación al día

Cualquier cambio de arquitectura, de modelo de datos, o cualquier decisión
sustancial (agregar/quitar una tecnología, cambiar una relación entre
tablas, una regla de negocio no obvia, etc.) debe reflejarse en `docs/` —
no dejar que el código y `docs/` diverjan.

**Antes de escribir en `docs/`, preguntar al usuario si corresponde
documentar el cambio** — no documentar de forma automática sin confirmar
primero.

## Tests

Antes de abrir un PR, correr `npm run check` desde la raíz (typecheck,
lint, formato y tests: lo mismo que el CI). Un módulo, regla de negocio o
código de error nuevo trae sus tests unitarios en el mismo PR: junto al
archivo (`*.spec.ts`), con repositorios falsos y los builders de
`apps/backend/src/testing/fixtures.ts`. Detalle en
[docs/testing.md](docs/testing.md).

## Convenciones de código

- **camelCase** para variables, funciones, propiedades y nombres de
  archivo TypeScript en todo el monorepo (backend, mobile, `packages/shared`).

## Seguridad de datos (Supabase)

El backend NestJS accede a Supabase con la service role key (bypassa RLS) y
es el punto central de control de acceso para la mayoría de las tablas.
El cliente mobile solo habla directo con Supabase (vía `anon key`) para
**Realtime** — por ahora eso es exclusivamente el dominio de chat.

**Toda tabla nueva lleva RLS activo.** Las que el mobile solo usa a través
de la API de NestJS (`posts`, `comments`, `votes`, `reports`, tablas
internas de jobs…) van con RLS **sin políticas**: el backend (service role)
se lo salta, y si algún día `anon` / `authenticated` recibieran permisos por
error, igual no verían nada. Esos roles tampoco tienen permisos sobre esas
tablas, y a cada función SQL nueva hay que quitarle el `EXECUTE` de `PUBLIC`.
Las tablas que el cliente mobile suscriba/lea directo vía Realtime
(`messages`, `conversations`, `notifications` si se implementa vía
suscripción directa) necesitan RLS **con políticas**. Ver
[docs/modelo-de-datos.md](docs/modelo-de-datos.md) (sección de acceso) y
[docs/chat-realtime.md](docs/chat-realtime.md) para el razonamiento
completo.
