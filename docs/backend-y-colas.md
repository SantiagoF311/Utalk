# Backend y sistema de colas

## Backend: NestJS

API HTTP en TypeScript. Expone los endpoints de posts, comentarios, votos,
chats, y es responsable de encolar los trabajos asíncronos descritos abajo.

## Hosting: Fly.io

### Por qué Fly.io y no otras opciones gratuitas

El backend necesita un **proceso persistente corriendo 24/7**, no
serverless puro, porque el worker de BullMQ funciona con un loop interno
que escucha la cola en Redis constantemente — no se activa por request
HTTP como una función serverless.

| Plataforma | Problema para este caso |
|---|---|
| Vercel/Netlify Functions | Serverless puro, no hay proceso persistente para el worker — descartado |
| Render (free tier) | El servicio se **duerme tras 15 min de inactividad HTTP** y tarda 30-50s en despertar. Mientras duerme, el worker de BullMQ no existe: los jobs se acumulan en Redis sin nadie que los procese, hasta que un request HTTP entrante despierta el proceso |
| Railway | Free tier es crédito limitado (~$5/mes) que se agota rápido con uso real |
| Oracle Cloud Free Tier | Gratis para siempre y con más recursos, pero requiere administrar un VPS completo a mano (Node, systemd/PM2, firewall, HTTPS) — mucha más fricción operativa |
| **Fly.io** | Free tier con proceso **siempre corriendo**, sin "sleep". Deploy simple (`fly deploy`), gestiona reinicios, logs y secrets. Mejor relación esfuerzo/resultado para este proyecto |

### Cómo funciona el problema del "sleep" (documentado para referencia)

1. Un usuario hace un request HTTP → el proceso está despierto → todo
   funciona normal, incluidos los workers.
2. Pasan 15 min sin tráfico HTTP → Render mata el contenedor completo,
   worker incluido.
3. Si había jobs pendientes en Redis en ese momento, quedan **inertes**
   (nadie los procesa) hasta que un nuevo request HTTP despierte el
   proceso.
4. Al despertar, el worker recién arrancado empieza a drenar de golpe todo
   el backlog acumulado — generando un pico de notificaciones tardías en
   vez de un flujo continuo.

Este comportamiento es incompatible con una arquitectura que depende de
tener un consumidor de cola siempre disponible, de ahí la elección de
Fly.io.

## Sistema de colas: BullMQ + Redis

### Redis: Upstash (serverless)

Redis en modalidad **serverless** — no se paga por tener una instancia
fija corriendo 24/7, sino **por comando ejecutado**. Encaja con un
proyecto de tráfico bajo/variable (desarrollo, demo universitaria): no se
paga nada mientras la app no se usa.

| | Redis tradicional (self-managed) | Redis serverless (Upstash) |
|---|---|---|
| Cómo se paga | Por tiempo de servidor prendido | Por comando ejecutado |
| Quién administra | Vos o el proveedor, una instancia fija dimensionada de antemano | Nadie de tu lado — API completamente gestionada |
| Ideal para | Tráfico alto y constante | Tráfico bajo/variable, desarrollo, demos |

Se usa la **misma instancia de Upstash en desarrollo y producción** — evita
instalar Redis localmente (Docker/WSL/Memurai en Windows) y mantiene el
comportamiento idéntico entre ambos entornos.

**Configuración de la base en Upstash**:

- Se conecta por **TCP** (`REDIS_URL`, `rediss://…`, con TLS), no por la
  API REST de Upstash (`UPSTASH_REDIS_REST_URL` / `_TOKEN`): BullMQ habla el
  protocolo de Redis a través de `ioredis`.
- **Eviction desactivado.** Con eviction, cuando se llena la memoria Upstash
  borra claves para hacer lugar, y en BullMQ esas claves son los jobs: se
  perderían en silencio. Sin eviction, si se llenara, la escritura falla con
  un error visible.

### Qué es cada pieza (para evitar confusión de términos)

- **Redis**: base de datos en memoria, clave-valor, con estructuras como
  listas, sets, sorted sets. Genérico — sirve para cache, sesiones,
  contadores, y también como backing store de sistemas de colas.
- **BullMQ**: librería de Node.js que implementa el concepto de cola de
  trabajos (jobs) — reintentos, prioridades, delays, rate limiting —
  usando Redis por debajo para persistir el estado. BullMQ **requiere**
  Redis; no existe sin él.
- **Kafka** (mencionado solo para contraste, no se usa): plataforma de
  streaming de eventos, no una cola de tareas. Ver
  [decisiones-descartadas.md](./decisiones-descartadas.md).

### Colas identificadas

| Job | Estado | Disparado por | Qué hace el worker |
|---|---|---|---|
| `notify-subscribers` (cola `notifications`) | Implementado | Se crea un post en una comunidad | Crea una notificación (tabla `notifications`) por cada **miembro de la comunidad**, salvo el autor y quien lo bloqueó. Supabase Realtime se la empuja al mobile conectado |
| `notify-new-message` | Pendiente | Se envía un mensaje de chat | Si el destinatario no tiene sesión Realtime activa, dispara una push notification vía Expo Push Notifications |
| `moderate-content` | Pendiente | Se crea un post (o mensaje, según alcance final) | Llama al servicio de moderación por IA; si el contenido viola reglas, oculta/elimina el post retroactivamente (ver "Publicación optimista" abajo) |
| ~~`recalculate-score`~~ | Descartado | — | El trending (`hot`) es una columna generada de Postgres con la fórmula de Reddit, sin cola ni cron — ver [datos-y-trending.md](./datos-y-trending.md) |

**Destinatarios de `notify-subscribers`: miembros de la comunidad, no del
panel.** El diseño original hablaba de "suscriptores del panel", pero los
paneles no tienen suscripción (son fijos: uno por universidad más el
general). Lo que existe es unirse a una comunidad, y unirse es seguir
(`community_members`, ver [modelo-de-datos.md](./modelo-de-datos.md)).

### Cómo está implementado (`modules/notifications`)

```
POST /posts ──▶ PostsService.create ──▶ guarda el post
                     │
                     └─▶ NotificationsService.enqueueNewPost ──▶ BullMQ (Redis)
                                                                     │
       NotificationsProcessor (worker, mismo proceso) ◀──────────────┘
                     │
                     └─▶ notify_new_post(post_id) en Postgres ──▶ notifications
                                                                     │
                                         Realtime ──▶ mobile (campana) ◀┘
```

- **Puertos y adaptadores, como el resto**: `PostsService` no sabe nada de
  BullMQ. El puerto `NotificationQueue` (`domain/notification.queue.ts`) lo
  implementa `BullmqNotificationQueue`; el worker
  (`notifications.processor.ts`) es un adaptador de entrada, como un
  controller.
- **El fan-out es un solo `insert … select`** en la función SQL
  `notify_new_post`, en vez de traer los miembros al backend e insertar de a
  uno: una comunidad grande no son miles de round-trips.
- **Si encolar falla, el post se publica igual.** `enqueueNewPost` atrapa el
  error y lo loguea: se pierde el aviso, nunca la publicación. Ojo: con la
  configuración por defecto de `ioredis`, si Upstash no responde, encolar
  puede tardar varios segundos en fallar (reintenta la conexión) y el
  request espera ese tiempo. El worker hereda la conexión de la cola, así
  que hacer que el productor falle rápido sin afectar al worker queda
  pendiente.
- **Opciones de los jobs** (`notifications.module.ts`): 3 intentos con
  backoff exponencial (5 s, 10 s, 20 s), los terminados se borran de Redis
  (`removeOnComplete`) y de los fallidos se guardan los últimos 100.
- **El payload** (`{ postId }`) es `notifySubscribersJobSchema` en
  `@utalk/shared`: lo usan el que encola y el worker, que además lo valida.
- **Lectura**: `GET /notifications` (las 50 más nuevas, sin las de posts
  eliminados por moderación), `GET /notifications/unread-count`,
  `POST /notifications/:id/read` y `POST /notifications/read-all`.

### Por qué el trabajo secundario nunca bloquea la respuesta al usuario

Regla de diseño aplicada en todos los casos: la acción principal (guardar
el post/voto/mensaje en Postgres) responde al usuario **inmediatamente**;
el trabajo secundario (notificar, moderar, recalcular rankings) se encola
y se procesa después, de forma completamente desacoplada.

```ts
// PostsService.create (simplificado)
const item = await this.postRepository.create({ ... }); // lo único que bloquea
await this.notificationsService.enqueueNewPost(item.post.id); // solo escribe en Redis
return toPostView(item, null, false); // responde ya, sin esperar al worker
```

Encolar un job (`queue.add(...)`) es una operación barata (solo escribe en
Redis) — el trabajo pesado real ocurre después, en el worker, sin afectar
el tiempo de respuesta del request original.

### Moderación de contenido: rate limiting del proveedor de IA

**Problema identificado**: el tier gratuito de proveedores de moderación
por IA (ej. OpenAI) tiene límites bajos (del orden de ~3 requests/minuto).
Si se intentan moderar varios posts en el mismo minuto, se recibirían
errores 429 (rate limit excedido).

**Solución**: no alcanza con "encolar y ya" — se necesita el **rate
limiter nativo de la cola de BullMQ**, que auto-limita cuántos jobs por
minuto se procesan, dejando el resto esperando en la cola sin generar
errores:

```ts
BullModule.registerQueue({
  name: 'moderation',
  limiter: {
    max: 3,
    duration: 60000, // 3 jobs por cada 60 segundos
  },
})
```

**Publicación optimista**: como consecuencia del rate limit, la moderación
no puede ser síncrona antes de publicar (bloquearía la publicación por
minutos si hay backlog). Se adopta el modelo usado por Reddit/Discord/X:
el post se publica de inmediato, y si la moderación (que corre después,
de forma asíncrona) determina que el contenido viola las reglas, se oculta
o elimina retroactivamente, notificando al autor.

### Idempotencia (a tener en cuenta al implementar)

Los jobs de BullMQ pueden reintentarse ante fallos parciales. Los
handlers deben diseñarse para producir el mismo resultado si se ejecutan
más de una vez con el mismo payload (ej. no duplicar notificaciones si
`notify-subscribers` se reintenta).

En `notify-subscribers` lo garantiza Postgres: `notifications` tiene un
unique `(user_id, post_id, type)` y la función inserta con `on conflict do
nothing`, así que un reintento no crea nada nuevo. Además, el job se encola
con un `jobId` fijo por post, para que BullMQ ignore un segundo encolado
del mismo post mientras el primero sigue en la cola.

## Rate limiting anti-spam (distinto de la moderación de contenido)

Para evitar abuso de la API en sí (fuerza bruta de contraseñas, spam de
posts y comentarios, saturar el backend), se usa `@nestjs/throttler`: un
guard global que cuenta las requests de cada IP por minuto y, al superar
el límite, responde 429 `TOO_MANY_REQUESTS`. Corre antes que la
autenticación, así frena también a quien manda tokens inválidos en masa.

| Endpoint | Límite por IP |
|---|---|
| cualquiera | 120 / min |
| `POST /auth/login` | 10 / min |
| `POST /posts` | 5 / min |
| `POST /comments` | 20 / min |
| `POST /reports` | 10 / min |
| `POST /conversations` (escribirle a alguien por primera vez) | 5 / min |
| `POST /conversations/:id/messages` | 40 / min |
| `GET /` (health check) | sin límite, para el monitoreo del hosting |

Definidos en `apps/backend/src/common/rateLimits.ts`. Detrás del proxy de
Fly.io, el backend usa `trust proxy` para ver la IP real del cliente — si
no, todas las requests parecerían venir de la IP del proxy.

**Almacenamiento del contador: en memoria (por ahora)**. La decisión
original era guardarlo en el Redis de Upstash. Redis ya está en el
proyecto (lo usa BullMQ), pero mientras el backend corra en una **sola
instancia**, contar en memoria es equivalente y no gasta comandos de
Upstash (que se cobran por comando). **Pasar a Redis** cuando el backend
corra en más de una instancia:
si no, cada instancia contaría por su lado y el límite real se
multiplicaría por la cantidad de instancias. El cambio es solo de
configuración del `ThrottlerModule` (otro storage), sin tocar los límites
ni los endpoints.

## Configuración del backend en producción

Variables de entorno que el backend necesita (en Fly.io, con
`fly secrets set ...`; en local, en `apps/backend/.env` — la plantilla con
todas está en `apps/backend/.env.example`):

| Variable | Para qué |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY` | Acceso a Supabase |
| `REDIS_URL` | Redis de Upstash para las colas de BullMQ (`rediss://default:<password>@<host>.upstash.io:6379`, la de la pestaña TCP). Sin ella el backend no arranca |
| `PORT` | Puerto HTTP (default 3000) |
| `CORS_ORIGINS` | Orígenes web que pueden llamar a la API, separados por coma (ej. `https://utalk.app`) |

**Sobre `CORS_ORIGINS`**: CORS es una protección de los navegadores —
solo afecta a la versión **web** de la app; la app nativa no manda
`Origin` y no se ve afectada. Sin la variable, el backend solo acepta
`http://localhost:8081` (Expo web en desarrollo). **Si se olvida en
producción**, la versión web no puede llamar a la API (el navegador lo
bloquea con "blocked by CORS policy") mientras la app nativa sigue
funcionando — un error fácil de no detectar.

El backend además agrega los headers de seguridad estándar con `helmet`
(`nosniff`, HSTS, sin `X-Powered-By`).
