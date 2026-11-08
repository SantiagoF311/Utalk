# Búsqueda

## Decisión: Postgres full-text search + `pg_trgm`

No se usa un motor de búsqueda dedicado (Elasticsearch, Meilisearch,
Typesense, Algolia). Se usa full-text search nativo de Postgres
(`tsvector`), complementado con la extensión `pg_trgm` para tolerancia a
errores de tipeo y búsqueda por similitud — ambas disponibles en Supabase
sin infraestructura adicional (`CREATE EXTENSION pg_trgm;` + un índice
GIN).

## Cómo está implementada

`GET /search?q=…&(panelId=…|communityId=…)&sort=relevance|new&cursor=…`
busca en **publicaciones y comentarios de un panel o de una comunidad**
(exactamente uno de los dos, como el feed), en una sola lista. **Nunca en
apodos**: nadie puede juntar desde el buscador todo lo que escribió alguien
(el diseño lo dice en la pantalla). Con `communityId`, el backend busca en
el panel de esa comunidad filtrando por ella (404 si no existe).

### En la base (migraciones `full_text_search` y `search_by_community`)

| Pieza | Qué es |
|---|---|
| `search_vector` (tsvector, columna generada) | Raíces de las palabras, en español y sin tildes. En `posts`, título con peso `A` y cuerpo `B` (el título pesa más al ordenar); en `comments`, el cuerpo. Índice GIN |
| `search_text` (text, columna generada) | El mismo texto en minúsculas y sin tildes, para comparar por trigramas. Índice GIN `gin_trgm_ops` |
| `immutable_unaccent()` | Envoltorio de `unaccent` que fija el diccionario. Hace falta porque una columna generada o un índice solo aceptan funciones `IMMUTABLE`, y `unaccent` no lo es |
| `search_content()` | La búsqueda en sí (ver abajo). `p_community_id` null = todo el panel. Se agregó en una migración aparte (`search_by_community`) que borra y recrea la función, porque la primera ya estaba aplicada |

Las columnas generadas se recalculan solas al crear o editar: no hay nada
que sincronizar (justamente el costo que tendría un motor aparte).

### Cómo coincide

1. **Full-text** (lo principal): todas las palabras tienen que estar, por
   raíz ("homologando" encuentra "homologar"). **La última palabra cuenta
   como prefijo** (`cafete:*`), porque la app busca mientras se escribe: sin
   esto, "cafete" no encontraría "cafetería" hasta terminar la palabra. Las
   palabras se limpian antes (sin tildes ni símbolos), así que nada de lo que
   se escriba puede romper la consulta.
2. **Trigramas** (`pg_trgm`, respaldo para errores de tipeo): si el
   full-text no la encuentra, coincide igual si la búsqueda se parece lo
   suficiente a alguna parte del texto (`word_similarity ≥ 0.55`; "cafetria"
   contra "cafetería" da 0.78). Solo con 4 letras o más: con menos, casi
   todo "se parece".

**Orden por relevancia**: lo que encontró el full-text va **siempre antes**
que lo encontrado solo por parecido (rank `1 + ts_rank` contra
`word_similarity`, que es menor que 1); a igual rank, lo más nuevo. "Reciente"
ordena solo por fecha.

**Por qué es una función SQL y no un select armado en el backend**: mezcla
dos tablas en un solo orden por relevancia, algo que el cliente de Supabase
no puede expresar. El backend la llama con `.rpc('search_content')`.

**Permisos**: Postgres deja ejecutar cualquier función a `PUBLIC` por
defecto, así que la migración se lo quita a `public`, `anon` y
`authenticated`: sin eso, el mobile podría llamarla directo con la anon key,
salteando el backend. Solo `service_role`.

**Comentarios borrados**: su texto sigue en la base (el borrado es lógico),
así que la función los excluye explícitamente.

**Paginación por offset** (no por cursor como el feed): un orden por
relevancia no tiene una clave estable para usar de cursor, y una búsqueda no
se recorre tan profundo. El backend pide uno de más para saber si hay otra
página.

**Al agregar o cambiar la función**: termina con `notify pgrst, 'reload
schema'`. PostgREST guarda en caché las funciones que existen y, sin
refrescarla, responde "Could not find the function … in the schema cache".

### En el mobile

La barra "Buscar en <panel>" de Inicio abre la búsqueda en el panel
elegido, con opción de pasar al general. El 🔍 de una comunidad la abre
**dentro de esa comunidad**, como en Reddit: un chip "c/… ✕" deja claro dónde
se busca (la ✕ quita el filtro y pasa a todo su panel), y antes de escribir
ofrece "Lo mejor de c/…" y "Nuevo en c/…". Busca mientras se escribe, con
una pausa de 400 ms para no mandar un request por letra. Las búsquedas
recientes se guardan en el dispositivo (ver [mobile.md](./mobile.md)). Sin
resultados, ofrece publicar la pregunta (en esa comunidad, si se buscaba en
una).

### Pendiente

- **Sugerencias mientras se escribe** (completar la búsqueda, como Google):
  hoy se muestran resultados, no sugerencias.
- **"Se está hablando de"** (temas tendencia del diseño 6a) y el aviso "hay
  N resultados más en General": necesitan calcular tendencias y contar en
  otro panel.
- **Ajustar el umbral de parecido** (0.55) si trae ruido o se queda corto: es
  una línea en la función.

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
