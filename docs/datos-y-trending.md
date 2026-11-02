# Datos y sistema de trending

## Postgres (Supabase) como fuente de verdad única

Todos los datos reales (posts, comentarios, votos, usuarios, mensajes)
viven exclusivamente en Postgres. Cualquier copia derivada en Redis
(descrita abajo) es siempre reconstruible desde Postgres — Redis nunca es
la fuente de verdad de nada.

## El problema: calcular "trending" sin recalcular todo en cada lectura

"Trending" (el orden `hot` del feed) responde a la pregunta: ¿qué posts
tuvieron más actividad, ponderando por recencia?

**Decisión adoptada**: fórmula "hot" de Reddit, calculada por Postgres en
una columna generada — sin cola, sin cron, sin Redis (Opción 4, abajo).
Las Opciones 1 a 3 se evaluaron antes y quedan documentadas como
alternativas.

### Dos familias de fórmulas: con decaimiento (Hacker News) y sin decaimiento (Reddit)

**Hacker News** divide los votos por una función que crece con la edad del
post:

```
score / (horas desde la publicación + 2)^1.5
```

El valor de un post **baja con el simple paso del tiempo**, aunque nadie
lo vote. (Una versión anterior de este documento la llamaba "el algoritmo
de Reddit" — es la de Hacker News.)

**Reddit** suma un término que depende solo de la fecha de publicación:

```
signo(score) · log10(max(|score|, 1)) + (segundos desde una época fija) / 45000
```

El valor de un post **solo cambia cuando cambia su score**. El paso del
tiempo se resuelve al revés: los posts nuevos nacen con un valor más alto
(cada 12,5 h más reciente equivale a 10x votos), en vez de hacer decaer a
los viejos. El `log10` hace que los primeros 10 votos pesen lo mismo que
los 90 siguientes, así un post nuevo compite sin necesitar cientos de
votos.

Esta diferencia es la que decide la arquitectura: con decaimiento hace
falta recalcular periódicamente todos los posts recientes (cron); sin
decaimiento, alcanza con recalcular cuando hay votos.

### Opción 1 — Score calculado al vuelo en cada lectura (fórmula HN)

```sql
SELECT *,
  (upvotes - downvotes) / POWER((EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 + 2), 1.5) AS score
FROM posts
WHERE panel_id = $1
ORDER BY score DESC
LIMIT 20;
```

- Sin infraestructura adicional, siempre exacto.
- Se recalcula la fórmula para todos los posts candidatos en **cada
  lectura del feed**, aunque nada haya cambiado entre una lectura y otra,
  y no se puede indexar (depende de `NOW()`).

### Opción 2 — Columna `trending_score` actualizada por BullMQ (fórmula HN)

Se recalcula solo cuando hay un evento relevante (voto, comentario nuevo),
vía un job de BullMQ:

```ts
@Processor('trending')
export class TrendingProcessor {
  @Process('recalculate-score')
  async handleRecalculate(job: Job<{ postId: string }>) {
    const post = await this.postsRepo.findOne(job.data.postId);
    const ageInHours = (Date.now() - post.createdAt.getTime()) / 3_600_000;
    const score = post.score / Math.pow(ageInHours + 2, 1.5);
    await this.postsRepo.update(post.id, { trendingScore: score });
  }
}
```

Leer el feed pasa a ser `ORDER BY trending_score DESC`. Pero como la
fórmula decae con el tiempo y el recálculo solo se dispara por eventos,
un post sin actividad queda "congelado" — hace falta además un cron
periódico (ver "Estrategia de sincronización" abajo).

**Por qué no se adoptó**: exige Redis, worker, cola, cron e idempotencia
de jobs, y el ranking queda atrasado hasta que corra el job — todo para
resolver un problema (el decaimiento) que la fórmula de Reddit no tiene.

### Opción 3 — Redis Sorted Set como índice acelerador

Se mantiene un **Sorted Set** de Redis (`trending:<forumId>`) con
`postId → score`, actualizado en tiempo real. Redis ordena
automáticamente por score y responde "top N" en microsegundos:

```
ZADD trending:forum-123 <score> <postId>
ZREVRANGE trending:forum-123 0 19   -- top 20 IDs, ya ordenados
```

Redis **no almacena el post completo** — solo ID + score. Con esos IDs se
hace una segunda query a Postgres (`WHERE id IN (...)`) para traer los
datos completos: una búsqueda directa por clave primaria, mucho más barata
que ordenar toda la tabla. Es el mismo concepto que usaba Reddit
(listas precalculadas, en su caso en Cassandra + memcached, recortadas a
~1000 elementos).

- Más rápido que ordenar en Postgres para volúmenes altos de lectura.
- Introduce una segunda fuente de datos a mantener sincronizada.

**No se implementa por ahora** — el volumen esperado (app universitaria)
no justifica la complejidad operativa extra. Se reevaluará solo si se
mide (`EXPLAIN ANALYZE`) que la query del feed `hot` de la Opción 4 se
vuelve lenta. Si llega, la fórmula de Reddit lo simplifica: basta un
`ZADD` por voto, sin recálculo periódico.

### Opción 4 — Fórmula de Reddit como columna generada (adoptada)

`posts.hot` es una columna generada (`generated always as
(hot_score(score, created_at)) stored`). La cadena completa:

```
voto → trigger actualiza posts.score → Postgres recalcula posts.hot
     → el feed ordena por hot con el índice (forum_id, hot desc, id desc)
```

Todo en la misma transacción que el voto: exacto al instante, sin
infraestructura adicional, sin nada que reconstruir (siempre se deriva de
`score` y `created_at`). Migración:
`20261103000000_feed_counters_hot_and_soft_delete.sql`.

- **Constante 45000** (12,5 h): la de Reddit, pensada para su volumen. Si
  en UTalk los buenos posts se hunden demasiado rápido, subirla (ej. 1-2
  días). Cambiarla exige recrear la columna (drop + add): reemplazar la
  función no recalcula las filas ya guardadas.
- **Sin votos nuevos, el orden entre dos posts nunca cambia** — los posts
  nuevos igual entran arriba. Es como funciona Reddit.

**Por qué Reddit no lo hace así y UTalk sí**: Reddit calcula el hot en la
aplicación, dentro del worker de su cola de votos, porque a su escala la
base es lo más difícil de escalar (se le quita todo el trabajo posible),
un post viral recibe miles de votos por minuto (con un trigger, todos
esperarían por la misma fila), y sus listas ordenadas viven fuera de
Postgres, donde un trigger no llega. Ninguna de esas condiciones aplica a
UTalk: una sola base casi sin carga, y el feed es un `ORDER BY` indexado
dentro de Postgres.

**Cuándo reconsiderar**: si se mide contención en los votos, pasar a
votos encolados y aplicados en lote (BullMQ); si el feed se vuelve lento,
la Opción 3.

## Estrategia de sincronización (solo si en el futuro se adopta la Opción 2 o 3)

Con la Opción 4 no aplica: `hot` se deriva siempre de `score` dentro de
Postgres. Queda documentada para cuando haya una copia derivada fuera de
Postgres. Se combinan tres mecanismos, cada uno resolviendo un problema
distinto:

1. **Cálculo por evento** (voto, comentario) — mantiene el trending
   sensible en tiempo real. Barato: solo toca el post afectado.
2. **Rebuild periódico acotado** — solo necesario con una fórmula con
   decaimiento: un job cron (ej. cada 2-4 horas) que recalcula los posts
   de las últimas 24-48h.
3. **Rebuild completo ante pérdida de datos** — si Redis pierde su
   estado (reinicio, o primera vez que se activa el sistema sobre datos
   preexistentes), se reconstruye el índice completo desde Postgres.

Este patrón (evento + rebuild periódico acotado + rebuild completo ante
falla) es general y reutilizable para cualquier otro dato que en el futuro
se decida cachear/derivar de Postgres — no es exclusivo de trending.

## Contadores: `score` y `comment_count`

`posts.score` (votos netos), `posts.comment_count` y `comments.score` los
mantienen triggers sobre `post_votes`/`comment_votes`/`comments` — ver
[modelo-de-datos.md](./modelo-de-datos.md#posts). Se descartó encolarlos
en BullMQ: son parte esencial del voto (el usuario espera ver el número
al instante), cuestan un `update` por clave primaria, y un job "sumar 1"
no es idempotente (un reintento sumaría dos veces).

## Comentarios anidados

Resuelto con `parent_id` simple: el árbol se arma en memoria a partir de
la lista plana del post, sin closure table ni `WITH RECURSIVE`. Ver
[modelo-de-datos.md](./modelo-de-datos.md#comments).
