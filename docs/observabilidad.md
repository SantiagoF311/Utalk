# Observabilidad

## Decisión: Sentry + logs nativos de Fly.io

No se centralizan ambos en una única herramienta (tipo Datadog) — se
consideró innecesario para la escala del proyecto. En su lugar, cada
herramienta cubre una necesidad distinta y complementaria:

- **Sentry**: captura los errores del backend (`@sentry/nestjs`) y de la
  app mobile (`@sentry/react-native`), agrupa el mismo error repetido en un
  solo "issue", muestra el stack trace y puede alertar (email/Slack) ante
  errores nuevos. Es el panel principal para "algo salió mal". Detalle en
  [Sentry](#sentry) abajo.
- **Logs de Fly.io** (`fly logs` o su dashboard): flujo crudo de todo lo
  que la app imprime (stdout/stderr) — se consulta puntualmente cuando se
  necesita contexto adicional que no fue una excepción capturada por
  Sentry.

No son redundantes: los logs son el detalle completo de todo, Sentry es el
resumen inteligente de los errores.

## Sentry

Dos proyectos en Sentry, uno por app, para que los errores no se mezclen:
`utalk-backend` (Nest.js) y `utalk-mobile` (React Native / Expo).

**Qué se reporta**:

| App | Qué va a Sentry | Dónde |
|---|---|---|
| Backend | Toda respuesta **5xx** de la API (falla nuestra). Los 4xx no: validación, permisos o "no existe" son respuestas esperables | `ProblemDetailsFilter` (`common/problemDetails.filter.ts`) |
| Backend | Un job de BullMQ que falla en su **último intento** (los intentos que todavía se van a reintentar no) | `NotificationsProcessor.onFailed` (`isFinalAttempt`) |
| Backend | Excepciones sin atrapar y promesas rechazadas sin `catch` | Automático (integraciones por defecto del SDK) |
| Mobile | Errores que rompen una pantalla y promesas sin atrapar | `Sentry.wrap` en `app/_layout.tsx`, configurado en `lib/sentry.ts` |

Los errores de la API **no** se reportan también desde el mobile: ya los
reporta el backend, y se verían duplicados.

**Solo errores.** Tracing, Profiling, Logs y Metrics quedan apagados:
hoy hace falta enterarse de los errores, no medir lentitud; Profiling se
cobra por uso al terminar la prueba de Sentry, y los logs ya los guarda
Fly.io. Si algo anda lento, Tracing se activa con `tracesSampleRate` (con
un muestreo bajo, para no gastar la cuota).

**Privacidad: nada de contenido.** Por defecto los SDK de Sentry
recolectan casi todo (cuerpos de requests, variables locales de cada
función, query strings, headers). En una red social anónima eso
mandaría a un tercero mensajes privados del chat, textos de posts,
búsquedas y tokens de sesión. Se configura al revés:

- **Backend** (`src/instrument.ts`, opción `dataCollection` de Sentry 11):
  sin cuerpos, sin variables locales, sin query string, sin cookies, sin
  datos de usuario y solo los headers `user-agent` y `content-type` (nunca
  `authorization`). Los jobs reportan solo ids.
- **Mobile** (`lib/sentry.ts`): `sendDefaultPii: false` (el SDK de React
  Native usa una versión anterior, sin `dataCollection`), y en el rastro
  previo al error (breadcrumbs) no van los `console.log` ni la query
  string de los pedidos.

Al agregar algo que se reporte a mano (`Sentry.captureException(error,
{ extra })`), mandar solo ids, nunca texto que haya escrito alguien.

**Apagado sin DSN.** Cada app lee su DSN de una variable; sin ella, Sentry
no manda nada. En desarrollo se deja vacía, así los errores locales no se
mezclan con los de producción.

| Variable | App | Para qué |
|---|---|---|
| `SENTRY_DSN` | backend | DSN de `utalk-backend` (en producción, secret de Fly.io) |
| `SENTRY_ENVIRONMENT` | backend | Opcional: separa errores por entorno (por defecto `development`) |
| `EXPO_PUBLIC_SENTRY_DSN` | mobile | DSN de `utalk-mobile` (no es secreto: solo sirve para mandar errores, no para leerlos) |
| `EXPO_PUBLIC_SENTRY_ENVIRONMENT` | mobile | Igual que en el backend |

El backend inicializa Sentry en `src/instrument.ts`, que `main.ts` importa
**antes que todo lo demás**, y lee ahí el `.env` (ConfigModule lo carga
recién al armar `AppModule`).

**Pendiente**:

- **Source maps del mobile**: en un build de producción (EAS) el código
  está minificado, y sin subir los source maps a Sentry el stack trace no
  dice en qué archivo y línea pasó. Se configura al armar el build
  (plugin `@sentry/react-native/expo` y un auth token de Sentry).
- **Fallas que se atrapan a propósito** (no poder encolar un aviso porque
  Redis no responde, no poder borrar una imagen del bucket) solo se
  loguean: no llegan a Sentry.

## Formato de errores de la API: Problem Details (RFC 9457)

Toda respuesta de error del backend tiene la misma forma, sin importar de
dónde salga (una regla de negocio, una validación de Zod, un pipe de Nest,
una ruta inexistente o un error inesperado). Se usa el estándar HTTP
**RFC 9457 "Problem Details for HTTP APIs"** (sucesor de RFC 7807),
con `Content-Type: application/problem+json` y dos extensiones propias,
`code` y `errors`:

```json
{
  "type": "urn:utalk:error:username-taken",
  "title": "Username already taken",
  "status": 409,
  "detail": "Username \"gato_azul\" is already taken",
  "instance": "/auth/complete-registration",
  "code": "USERNAME_TAKEN",
  "errors": []
}
```

| Campo | Para qué |
|---|---|
| `code` | Identificador estable que el **cliente** usa para decidir qué hacer y qué texto mostrar. Lista cerrada en `packages/shared/src/error.ts` (`ERROR_CODES`). |
| `detail` | Explicación técnica de este caso, en inglés. Para logs y depuración — **nunca se muestra al usuario**; el mobile traduce `code` a un mensaje en español. |
| `type` / `title` | Los del RFC: URI fija del tipo de error (una URN, porque no hay página de documentación detrás) y su resumen. |
| `errors` | Detalle por campo (`{ path, message }`); vacío salvo en `VALIDATION_FAILED`. |
| `status` / `instance` | Código HTTP y ruta del request. |

**Por qué un estándar y no un formato propio**: las APIs grandes (Stripe,
GitHub, Google) usan formatos propios, pero todos con los mismos
elementos — status, código estable, mensaje y detalle por campo. RFC 9457
los ofrece con nombres estándar, lo adoptan frameworks como Spring Boot y
ASP.NET Core, y cuesta lo mismo que uno propio.

**Cómo se implementa en el backend**:

- Los services lanzan `AppException(code, detail)`
  (`apps/backend/src/common/appException.ts`). El status HTTP **no** se
  pasa: sale del catálogo `ERROR_CATALOG` (`common/errorCatalog.ts`), así
  quien lanza el error no puede equivocarse de status. Agregar un código
  = agregarlo en `ERROR_CODES` (shared) y en el catálogo; TypeScript
  obliga a que estén los dos.
- Un único filtro global, `ProblemDetailsFilter`
  (`common/problemDetails.filter.ts`, `@Catch()` sin argumentos),
  convierte todo a Problem Details. Las excepciones propias de Nest
  (ParseUUIDPipe, 404 de ruta, JSON inválido, un archivo de más de 5 MB)
  reciben un código genérico según su status (`BAD_REQUEST`, `NOT_FOUND`,
  `PAYLOAD_TOO_LARGE`…).
- **Errores de Postgres**: se traducen en el **repositorio** (el adaptador
  de infraestructura), nunca en el filtro — así la capa HTTP no conoce
  códigos de Postgres. Hoy se traduce el `23505` (unique violation): dos
  requests simultáneos que pasan el chequeo previo del service y chocan
  contra la constraint (username, slug de comunidad, slug/universidad de panel)
  responden 409 con su código, no 500.
- **Errores inesperados** (cualquier cosa que no sea una de las anteriores,
  típicamente un error de Supabase no traducido): responden 500
  `INTERNAL_ERROR` con un `detail` genérico — el mensaje real de la base
  nunca llega al cliente — y se loguean completos (método, ruta, stack)
  con el `Logger` de Nest. Además, el filtro reporta a Sentry todo lo que
  sale con status 5xx (ver [Sentry](#sentry)).

## Backups

Supabase realiza backups automáticos de Postgres incluso en el plan
gratuito (con retención limitada). No requiere configuración adicional,
pero vale la pena confirmar que estén activos.

## Idempotencia de jobs

Ver [backend-y-colas.md](./backend-y-colas.md#idempotencia-a-tener-en-cuenta-al-implementar) —
los jobs de BullMQ deben diseñarse para producir el mismo resultado si se
procesan más de una vez (reintentos ante fallos parciales).
