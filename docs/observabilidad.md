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

## Backups

Supabase realiza backups automáticos de Postgres incluso en el plan
gratuito (con retención limitada). No requiere configuración adicional,
pero vale la pena confirmar que estén activos.

## Idempotencia de jobs

Ver [backend-y-colas.md](./backend-y-colas.md#idempotencia-a-tener-en-cuenta-al-implementar) —
los jobs de BullMQ deben diseñarse para producir el mismo resultado si se
procesan más de una vez (reintentos ante fallos parciales).
