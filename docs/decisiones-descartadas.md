# Decisiones descartadas

Tecnologías evaluadas durante el diseño y explícitamente **no** adoptadas,
con el razonamiento de por qué — para no re-evaluarlas sin motivo nuevo, y
para dejar registrado bajo qué condición sí valdría la pena reconsiderarlas.

## Turborepo / Nx

**Por qué no**: el monorepo tiene 3 paquetes (`backend`, `mobile`,
`shared`). No hay suficiente cantidad de paquetes ni tiempos de build lo
bastante largos como para necesitar cache de builds o ejecución
incremental — sería complejidad sin problema real que resolver.

**Cuándo reconsiderar**: si `npm run build` empieza a tardar de forma
notoria por rebuildear todo el monorepo ante un cambio mínimo, o si se
necesita que CI solo testee los paquetes afectados por un PR.

## Kafka

**Por qué no**: Kafka es una plataforma de **streaming de eventos**
(log persistente, múltiples consumidores independientes leyendo el mismo
evento sin que el productor los conozca) — pensada para arquitecturas de
microservicios desacoplados. El problema real de este proyecto es
"ejecutar una tarea sin bloquear al usuario" (notificar, moderar,
recalcular trending), que es exactamente el modelo de una **cola de
trabajos**, no de un bus de eventos. Además, Kafka exige operar un
cluster (brokers, particiones, replicación) — complejidad operativa
injustificada para un monorepo con un solo backend.

**Diferencia de modelo** (no solo de escala):
- Cola (BullMQ): un job se procesa y desaparece; el productor sabe
  exactamente a qué cola manda el trabajo.
- Kafka: un evento se publica y persiste; cualquier cantidad de
  consumidores independientes pueden leerlo, cada uno sin saber de los
  otros ni del productor.

**Cuándo reconsiderar**: si la arquitectura evolucionara a múltiples
servicios verdaderamente independientes (no solo módulos de un mismo
backend) que necesiten reaccionar al mismo evento sin conocerse entre sí.

## Microservicios

**Por qué no**: la arquitectura decidida es un **monorepo modular** — un
único backend NestJS. No hay necesidad de escalar o desplegar partes del
sistema de forma independiente a esta escala.

## Elasticsearch / Meilisearch / Typesense / Algolia

**Por qué no (por ahora)**: ver [busqueda.md](./busqueda.md) —
Postgres full-text search + `pg_trgm` cubre las necesidades de búsqueda
esperadas sin agregar un servicio adicional que mantener sincronizado y
corriendo 24/7.

## Render (como hosting del backend)

**Por qué no**: el free tier duerme el proceso tras 15 min de
inactividad HTTP, lo cual mata al worker de BullMQ mientras duerme — los
jobs pendientes en Redis quedan sin procesar hasta que un request externo
despierte el proceso. Incompatible con la necesidad de un consumidor de
cola siempre disponible. Ver
[backend-y-colas.md](./backend-y-colas.md#hosting-flyio).

## Oracle Cloud Free Tier (como hosting del backend)

**Por qué no**: aunque el free tier es más generoso en recursos y sin
límite de tiempo, requiere administrar un VPS completo a mano (instalar
Node, configurar systemd/PM2, firewall, HTTPS) — mucha más fricción
operativa que Fly.io para el mismo resultado, en un proyecto donde el
foco es aprender diseño de sistema, no administración de servidores.

**Cuándo reconsiderar**: si el proyecto creciera y necesitara recursos
gratuitos más grandes por más tiempo, justificando invertir el esfuerzo
de aprender a administrar el VPS.

## Redis tradicional / self-hosted (en vez de Upstash)

**Por qué no**: correr Redis local requiere Docker, WSL2, o un fork como
Memurai en Windows — fricción de setup evitable. Redis serverless
(Upstash) da la misma funcionalidad, se paga solo por uso, y permite usar
la misma instancia en desarrollo y producción sin instalar nada local.
