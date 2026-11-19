# ACQ de rendimiento del feed (GET /posts)

Scripts para medir el tiempo de respuesta de `GET /posts` (el feed, con sus
tres sorts: `hot`, `new`, `top`) bajo datos de volumen. No forman parte del
build ni del CI — son herramientas puntuales para correr a mano.

Corren contra el Supabase de desarrollo que ya tenga configurado
`apps/backend/.env` (no hay Postgres local en este proyecto). Todo lo que
siembran queda bajo el slug `perf-test`, separado de los datos reales, y se
borra con el script de limpieza.

## 1. Sembrar datos

Desde `apps/backend`:

```
node --loader ts-node/esm --experimental-specifier-resolution=node scripts/perf/seedFeedPerf.ts
```

(`npx ts-node --esm` no alcanza acá: el resolver de módulos de ts-node 10
en modo ESM no sigue imports relativos sin el flag de resolución extra.)

`universities` es un catálogo cerrado — el backend nunca lo escribe, solo
lee (ver `20261104000000_grant_service_role_backend_tables.sql`) — así que
el seed reusa la primera universidad que encuentra en vez de crear una.
Crea 1 panel general de prueba, 10 comunidades, 50 usuarios y 5000 posts
con `score` y `created_at` variados (para que `hot`/`new`/`top` ordenen de
verdad). Al final imprime un JSON con las credenciales y los IDs que
necesita el paso 3.

## 2. Levantar el backend

En otra terminal, desde la raíz del repo:

```
npm run start:dev -w apps/backend
```

## 3. Correr la carga con k6

```
k6 run scripts/perf/feed.k6.js \
  -e BASE_URL=http://localhost:3000 \
  -e LOGIN_EMAIL=<loginEmail del paso 1> \
  -e LOGIN_PASSWORD=<loginPassword del paso 1> \
  -e COMMUNITY_ID=<communityId del paso 1> \
  -e PANEL_ID=<panelId del paso 1> \
  -e AUTHOR_ID=<authorId del paso 1>
```

Corre dos escenarios secuenciales (2 min cada uno, 1 VU): feed por
`communityId` (caso indexado, `posts_community_hot_idx` y análogos) y feed
por `panelId` (join con `communities` sin índice dedicado — ver
`posts.repository.findPage`). Cada iteración pagina el feed completo por
cursor en los tres sorts, como el scroll infinito del mobile.

La carga se mantiene deliberadamente baja (1 req/s por escenario) para no
chocar contra el rate limit default de 120 req/min por IP
(`src/common/rateLimits.ts`), que no se tocó. k6 imprime percentiles
(p95/p99) de `http_req_duration` al terminar — ahí está el tiempo de
respuesta real del feed.

Para forzar más concurrencia (ver cómo degrada bajo carga más alta en vez
de solo medir latencia base), subir `vus` en `options.scenarios` del script
va a empezar a devolver 429 antes de revelar nada del feed — para eso hay
que subir el rate limit default temporalmente, no cambiarlo acá.

## 4. Limpiar

```
node --loader ts-node/esm --experimental-specifier-resolution=node scripts/perf/cleanupFeedPerf.ts
```

Borra todo lo creado en el paso 1 (usuarios de `auth.users`, perfiles,
panel, comunidades y posts en cascada). No toca la universidad reusada.
