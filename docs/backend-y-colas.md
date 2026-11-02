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

| Cola | Disparada por | Qué hace el worker |
|---|---|---|
| `notify-subscribers` | Se crea un post en un panel | Busca suscriptores del panel, genera notificaciones (inserta en tabla `notifications`, que Supabase Realtime empuja a los clientes conectados) |
| `notify-new-message` | Se envía un mensaje de chat | Si el destinatario no tiene sesión Realtime activa, dispara una push notification vía Expo Push Notifications |
| `moderate-content` | Se crea un post (o mensaje, según alcance final) | Llama al servicio de moderación por IA; si el contenido viola reglas, oculta/elimina el post retroactivamente (ver "Publicación optimista" abajo) |
| ~~`recalculate-score`~~ | — | **Descartada**: el trending (`hot`) es una columna generada de Postgres con la fórmula de Reddit, sin cola ni cron — ver [datos-y-trending.md](./datos-y-trending.md) |

### Por qué el trabajo secundario nunca bloquea la respuesta al usuario

Regla de diseño aplicada en todos los casos: la acción principal (guardar
el post/voto/mensaje en Postgres) responde al usuario **inmediatamente**;
el trabajo secundario (notificar, moderar, recalcular rankings) se encola
y se procesa después, de forma completamente desacoplada.

```ts
async createPost(dto: CreatePostDto) {
  const post = await this.postsRepo.insert(dto); // lo único que bloquea

  await this.notificationsQueue.add('notify-subscribers', { postId: post.id });
  await this.moderationQueue.add('moderate-content', { postId: post.id });

  return post; // responde ya, sin esperar el procesamiento de los jobs
}
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

## Rate limiting anti-spam (distinto de la moderación de contenido)

Para evitar abuso de la API en sí (spam de posts, votos repetidos), se usa
`@nestjs/throttler`, que reutiliza el mismo Redis de Upstash como backend
de conteo — no requiere infraestructura adicional. Esto es una decisión de
implementación, no de arquitectura de sistema.
