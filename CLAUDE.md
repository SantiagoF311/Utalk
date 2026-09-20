# UTalk

Red social anónima interuniversitaria: paneles por universidad + uno
general, apodo fijo tipo Reddit, votos, comentarios anidados, chats,
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
trabajos async (notificaciones, moderación, trending) · Postgres full-text
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
├── <dominio>.controller.ts
└── <dominio>.module.ts
```

Regla no negociable: el código en `domain/` nunca importa nada de
`infrastructure/` ni de `@supabase/supabase-js` — el `service` depende
del puerto (`interface`), nunca de la implementación concreta. Cuando un
módulo necesita un dato de otro dentro del mismo request, se inyecta
directo (patrón estándar de Nest) — no eventos genéricos, no colas (las
colas de BullMQ son solo para lo ya definido como async: notificaciones,
moderación, trending).

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

## Convenciones de código

- **camelCase** para variables, funciones, propiedades y nombres de
  archivo TypeScript en todo el monorepo (backend, mobile, `packages/shared`).

## Seguridad de datos (Supabase)

El backend NestJS accede a Supabase con la service role key (bypassa RLS) y
es el punto central de control de acceso para la mayoría de las tablas.
El cliente mobile solo habla directo con Supabase (vía `anon key`) para
**Realtime** — por ahora eso es exclusivamente el dominio de chat.

**RLS debe estar activo** en cualquier tabla que el cliente mobile
suscriba/lea directo vía Realtime (`messages`, `conversations`,
`notifications` si se implementa vía suscripción directa). El resto de las
tablas (`posts`, `comments`, `votes`, `reports`, tablas internas de jobs)
no necesitan RLS mientras el mobile siga accediendo a ellas únicamente a
través de la API de NestJS, no directo. Ver
[docs/observabilidad.md](docs/observabilidad.md) y
[docs/chat-realtime.md](docs/chat-realtime.md) para el razonamiento
completo.
