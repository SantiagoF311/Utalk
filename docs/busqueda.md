# Búsqueda

## Decisión: Postgres full-text search + `pg_trgm`

No se usa un motor de búsqueda dedicado (Elasticsearch, Meilisearch,
Typesense, Algolia). Se usa full-text search nativo de Postgres
(`tsvector`), complementado con la extensión `pg_trgm` para tolerancia a
errores de tipeo y búsqueda por similitud — ambas disponibles en Supabase
sin infraestructura adicional (`CREATE EXTENSION pg_trgm;` + un índice
GIN).

## Por qué no un motor dedicado (por ahora)

Un motor de búsqueda dedicado se justifica cuando aparece alguna de estas
señales medibles, ninguna de las cuales aplica a la escala esperada de
este proyecto (app universitaria, volumen acotado por naturaleza):

1. **Volumen**: Postgres FTS funciona bien hasta cientos de miles o pocos
   millones de filas; recién ahí el índice empieza a pesar.
2. **Relevancia sofisticada**: autocompletado en tiempo real, fuzzy
   matching avanzado, ranking que combine múltiples señales — terreno de
   motores dedicados, no de expresividad que Postgres ofrezca de forma
   simple.
3. **Facetas/filtros combinados complejos**: búsquedas con múltiples
   dimensiones cruzadas (texto + universidad + fecha + trending + conteo
   por categoría) empiezan a ser costosas de expresar en SQL puro a
   medida que se agregan dimensiones.
4. **Concurrencia alta compitiendo con carga transaccional**: separar la
   búsqueda de la base transaccional evita que ambas cargas se compitan
   por recursos.

## Si en el futuro se justifica migrar

**Meilisearch** (self-hosted) sería la opción recomendada, evaluada y
descartada por ahora:

- Más simple de operar que Elasticsearch, buen soporte de tolerancia a
  errores de tipeo por defecto.
- Podría desplegarse en el mismo ecosistema de Fly.io (soporte directo
  para Meilisearch con volúmenes persistentes en el free tier).
- El costo real no es la instalación (medio día de trabajo) sino la
  **sincronización continua** con Postgres: indexar al crear/editar/borrar
  posts (otro job de BullMQ, mismo patrón que trending), un rebuild
  inicial, y sumar un servicio más corriendo 24/7 que compite por
  recursos del free tier de Fly.io con el backend.

**Regla de decisión**: no migrar por intuición — medir con
`EXPLAIN ANALYZE` si las queries de búsqueda superan de forma consistente
~200-300ms, o si el producto pide una feature que Postgres genuinamente no
puede expresar bien (autocompletado instantáneo, búsqueda semántica).
