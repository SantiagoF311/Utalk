# Datos y sistema de trending

## Postgres (Supabase) como fuente de verdad única

Todos los datos reales (posts, comentarios, votos, usuarios, mensajes)
viven exclusivamente en Postgres. Cualquier copia derivada en Redis
(descrita abajo) es siempre reconstruible desde Postgres — Redis nunca es
la fuente de verdad de nada.

## El problema: calcular "trending" sin recalcular todo en cada lectura

"Trending" responde a la pregunta: ¿qué posts tuvieron más actividad
(votos + comentarios), ponderando por recencia? Se evaluaron tres
niveles de solución, de más simple a más sofisticado.

### Opción 1 — Score calculado al vuelo en cada lectura

```sql
SELECT *,
  (upvotes - downvotes) / POWER((EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 + 2), 1.5) AS score
FROM posts
WHERE panel_id = $1
ORDER BY score DESC
LIMIT 20;
```

(Fórmula equivalente al algoritmo "hot" de Reddit: los votos netos se
dividen por una función que crece con la edad del post, así un post viejo
necesita más votos para mantenerse arriba.)

- Sin infraestructura adicional, siempre exacto.
- Se recalcula la fórmula para todos los posts candidatos en **cada
  lectura del feed**, aunque nada haya cambiado entre una lectura y otra.

### Opción 2 — Score precalculado en una columna, actualizado por BullMQ

Se agrega `trending_score` a la tabla `posts`. En vez de calcular en cada
lectura, se recalcula solo cuando hay un evento relevante (voto,
comentario nuevo), vía un job de BullMQ:

```ts
async votePost(postId: string, userId: string, direction: 1 | -1) {
  await this.votesRepo.upsertVote(postId, userId, direction);
  await this.trendingQueue.add('recalculate-score', { postId });
  return { success: true }; // responde ya, sin esperar el recálculo
}
```

```ts
@Processor('trending')
export class TrendingProcessor {
  @Process('recalculate-score')
  async handleRecalculate(job: Job<{ postId: string }>) {
    const post = await this.postsRepo.findOne(job.data.postId);
    const ageInHours = (Date.now() - post.createdAt.getTime()) / 3_600_000;
    const score = (post.upvotes - post.downvotes) / Math.pow(ageInHours + 2, 1.5);
    await this.postsRepo.update(post.id, { trendingScore: score });
  }
}
```

Leer el feed pasa a ser una query trivial (`ORDER BY trending_score DESC`),
sin recalcular nada. El costo se mueve de "cada lectura" (frecuente) a
"cada evento" (menos frecuente), lo cual es más barato en general.

**Problema pendiente de esta opción sola**: el score depende de la edad
del post, que cambia con el simple paso del tiempo — pero el recálculo
solo se dispara por eventos (votos/comentarios). Un post sin actividad
nueva queda con el score "congelado", sin reflejar que debería decaer.
Se resuelve con un job periódico (ver más abajo).

### Opción 3 — Redis Sorted Set como índice acelerador

Se mantiene un **Sorted Set** de Redis (`trending:<panelId>`) con
`postId → score`, actualizado en tiempo real. Redis ordena
automáticamente por score y responde "top N" en microsegundos:

```
ZADD trending:panel-123 <score> <postId>
ZREVRANGE trending:panel-123 0 19   -- top 20 IDs, ya ordenados
```

Redis **no almacena el post completo** — solo ID + score. Con esos IDs se
hace una segunda query a Postgres (`WHERE id IN (...)`) para traer los
datos completos: una búsqueda directa por clave primaria, mucho más barata
que ordenar toda la tabla.

- Más rápido que ordenar en Postgres para volúmenes altos de lectura.
- Introduce una segunda fuente de datos a mantener sincronizada.

**Decisión para este proyecto**: se documenta como opción conocida, pero
**no se implementa por ahora** — el volumen esperado (app universitaria)
no justifica la complejidad operativa extra de un Sorted Set. Se
reevaluará solo si se mide que las queries de Opción 2 empiezan a ser
lentas.

## Estrategia de sincronización adoptada (aplica a Opción 2, y a Opción 3 si se implementa en el futuro)

Se combinan tres mecanismos, cada uno resolviendo un problema distinto:

1. **Cálculo por evento** (voto, comentario) — mantiene el trending
   sensible en tiempo real. Barato: solo toca el post afectado.
2. **Rebuild periódico acotado** — un job cron (ej. cada 2-4 horas) que
   recalcula el score de los posts de las últimas 24-48h, para reflejar
   el decaimiento por el simple paso del tiempo aunque no haya actividad
   nueva. No hace falta más frecuencia porque el decaimiento es gradual y
   no se percibe si tarda un par de horas en reflejarse; y no hace falta
   recorrer posts viejos porque ya decayeron tanto que su score exacto no
   afecta el ranking.
3. **Rebuild completo ante pérdida de datos** — si Redis pierde su
   estado (reinicio, o primera vez que se activa el sistema sobre datos
   preexistentes), se reconstruye el índice completo desde Postgres. Este
   mecanismo es el que garantiza que Redis (o la columna `trending_score`)
   nunca sea una fuente de verdad irremplazable.

Este patrón (evento + rebuild periódico acotado + rebuild completo ante
falla) es general y reutilizable para cualquier otro dato que en el futuro
se decida cachear/derivar de Postgres — no es exclusivo de trending.

## Comentarios anidados

Decisión de modelado de datos (no de arquitectura de sistema), pendiente
de definir al momento de diseñar el schema — opciones típicas: closure
table, o `parent_id` + `path`/recursión con `WITH RECURSIVE`.
