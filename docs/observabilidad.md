# Observabilidad

## Decisión: Sentry + logs nativos de Fly.io

No se centralizan ambos en una única herramienta (tipo Datadog) — se
consideró innecesario para la escala del proyecto. En su lugar, cada
herramienta cubre una necesidad distinta y complementaria:

- **Sentry**: captura excepciones automáticamente (integración
  `@sentry/nestjs`), agrupa el mismo error repetido en un solo "issue",
  muestra stack trace, línea de código y usuarios afectados, y puede
  alertar (email/Slack) ante errores nuevos. Es el panel principal para
  "algo salió mal".
- **Logs de Fly.io** (`fly logs` o su dashboard): flujo crudo de todo lo
  que la app imprime (stdout/stderr) — se consulta puntualmente cuando se
  necesita contexto adicional que no fue una excepción capturada por
  Sentry.

No son redundantes: los logs son el detalle completo de todo, Sentry es el
resumen inteligente de los errores.

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
  con el `Logger` de Nest. Cuando se agregue Sentry, este es el punto
  donde se reportan.

## Backups

Supabase realiza backups automáticos de Postgres incluso en el plan
gratuito (con retención limitada). No requiere configuración adicional,
pero vale la pena confirmar que estén activos.

## Idempotencia de jobs

Ver [backend-y-colas.md](./backend-y-colas.md#idempotencia-a-tener-en-cuenta-al-implementar) —
los jobs de BullMQ deben diseñarse para producir el mismo resultado si se
procesan más de una vez (reintentos ante fallos parciales).
