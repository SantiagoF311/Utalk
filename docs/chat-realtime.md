# Chat en tiempo real

## Alcance

Chats 1 a 1 (sin grupos), con: mensajes en tiempo real, historial,
"Visto", "escribiendo…", **solicitudes de mensaje** y **bloqueo de
usuarios**.

Fuera de alcance por ahora: reportar mensajes (los chats no son de ninguna
comunidad, así que solo los moderarían admins; extender `reports` y la
moderación es una rama propia), push con la app cerrada (ver más abajo) y
"en línea" (decidido no tenerlo, ver más abajo).

## Arquitectura: se escribe por la API, se lee por Realtime

```
mobile ──POST /conversations…──▶ NestJS (service role) ──insert──▶ Postgres
   ▲                                                                 │
   └──────────── Supabase Realtime (postgres_changes, con RLS) ◀──────┘
```

- **Todo lo que escribe** (empezar una conversación, mandar un mensaje,
  marcar como leído, bloquear) **va por la API** de NestJS, módulos `chat`
  y `blocks`. El backend inserta con la service role key.
- **El mobile solo lee directo de Supabase por Realtime**: los mensajes
  nuevos, los "Visto" y las solicitudes aceptadas le llegan como eventos
  de `postgres_changes`. El historial y la lista de chats también se piden
  a la API.

**Por qué así y no que el mobile inserte directo**: las reglas (solicitudes,
bloqueos, largo del mensaje, rate limit, no escribirse a sí mismo) quedan en
el backend, con la misma arquitectura hexagonal y los mismos tests que el
resto, en vez de repartidas en políticas SQL. Y cuando llegue la push, el
backend ya es quien guarda el mensaje: encola el job ahí mismo.

### Acceso (RLS)

`conversations` y `messages` son las primeras tablas que el mobile lee
directo, así que llevan **RLS con políticas**, solo de `SELECT`:

- `conversations_select_participant`: cada uno ve las conversaciones donde
  es `user_a` o `user_b`.
- `messages_select_participant`: los mensajes de esas conversaciones.

`authenticated` tiene `SELECT` sobre esas dos tablas y nada más: sin
`INSERT`/`UPDATE`/`DELETE`, aunque alguien use la anon key a mano no puede
escribir. Realtime aplica estas políticas a cada suscriptor, por eso el
mobile se suscribe a toda la tabla sin filtrar por conversación y solo le
llega lo suyo. `user_blocks` es solo del backend (RLS sin políticas, sin
permisos para `anon`/`authenticated`): nadie puede ver a quién bloqueó otro.

Las dos tablas están en la publicación `supabase_realtime` (migración
`chat`).

## Modelo

Detalle de columnas en [modelo-de-datos.md](./modelo-de-datos.md#chat).

- **`conversations`**: una por par de usuarios, guardados ordenados
  (`user_a < user_b`, con unique) para que el mismo par no quede dos veces.
  `initiated_by` es quien escribió primero, `accepted_at` cuándo se aceptó
  (null = solicitud) y `last_message_at` ordena la lista (lo mantiene un
  trigger).
- **`messages`**: `body` (1 a 2000 caracteres) y `read_at` (el "Visto").
- **`user_blocks`**: `blocker_id` → `blocked_id`.

## Solicitudes de mensaje

En una red anónima, el riesgo principal del chat es el acoso por mensaje
privado. Por eso escribirle a alguien por primera vez no abre un chat: le
manda una **solicitud** (como Instagram o Reddit).

1. A le escribe a B (`POST /conversations`). Se crea la conversación con
   ese primer mensaje, en una transacción (`start_conversation`).
2. A B le aparece en **Chats → Solicitudes**. A la ve en Chats como
   "Esperando que acepte".
3. **A no puede mandar otro mensaje** hasta que B responda
   (`MESSAGE_REQUEST_PENDING`): un desconocido no puede llenarle el chat a
   nadie.
4. **Abrir la solicitud no la marca como leída**: A no sabe si B la vio
   hasta que responda.
5. **B la acepta respondiendo** (o bloquea a A). Desde ahí escriben libre.

El estado se calcula para quien mira (`ConversationEntity.statusFor`):
`accepted`, `request_received` o `request_sent`.

## Bloqueo

- Se bloquea desde el perfil de alguien o desde el "···" de la
  conversación; se desbloquea en Ajustes → Bloqueados.
- **Corta los mensajes en los dos sentidos**: el bloqueado no puede
  escribirte, y tú tampoco a él hasta desbloquearlo. El error
  (`CANNOT_MESSAGE_USER`) no dice quién bloqueó a quién.
- La conversación sale de la lista de quien bloqueó. **El bloqueado no se
  entera**: sigue viendo la conversación, pero no puede mandar nada.
- Bloquear y desbloquear son idempotentes (`PUT` / `DELETE
  /blocks/:userId`).

## Tiempo real en el mobile

| Qué | Cómo |
|---|---|
| Mensajes nuevos | `postgres_changes` INSERT en `messages`: se agrega a la caché de esa conversación (sin duplicar el que uno mismo mandó) y se refresca la lista |
| "Visto" | `postgres_changes` UPDATE en `messages` (`read_at`). Se marca al abrir la conversación (`POST /conversations/:id/read`) y solo se muestra debajo del último mensaje propio |
| Solicitud aceptada | `postgres_changes` UPDATE en `conversations` (`accepted_at`) |
| "Escribiendo…" | Broadcast (ver abajo) |

Una sola suscripción para todo el chat (`hooks/useChatRealtime.ts`),
montada en el layout del drawer mientras hay sesión: la lista y el
contador de no leídos de la pestaña se actualizan en cualquier pantalla.

### "Escribiendo…": Broadcast, no Presence

Supabase Realtime tiene dos formas de mandar cosas entre clientes sin
pasar por la base:

- **Broadcast**: mensajes sueltos. Le llegan a quien está conectado en ese
  momento y no quedan guardados.
- **Presence**: un estado compartido que Supabase mantiene sincronizado.
  Quien entra al canal ve enseguida el estado de los demás, y el de quien
  se desconecta se borra solo.

"Escribiendo…" es un aviso que vence en segundos, así que se usa
**Broadcast** (`hooks/useTypingIndicator.ts`): mientras se tipea, se manda
un aviso como mucho cada 2 s, y del otro lado se muestra hasta 4 s
después del último. Solo viaja el id de quien escribe, nunca el texto. Con
Presence también haría falta ese temporizador, y la única ventaja (ver
"escribiendo…" en el instante de abrir el chat, en vez de hasta 2 s
después) no justifica sincronizar estado.

El canal es `typing:<id de la conversación>` y es **público**: requiere que
la configuración de Realtime del proyecto permita canales públicos. El
nombre es un UUID que solo conocen los dos participantes, y lo que viaja no
tiene contenido.

### Sin "en línea"

Presence es la herramienta para mostrar "en línea", y se decidió **no
tenerlo**: en una red anónima, ver cuándo se conecta alguien permite
cruzarlo con la vida real ("se conecta justo cuando termina la clase de
las 10") y adivinar quién es. "Visto" y "escribiendo…" no tienen ese
problema: solo existen dentro de una conversación, con esa persona.

Si algún día se agrega: opcional y apagado por defecto, solo en chats
aceptados (nunca a desconocidos) y recíproco (si no muestras el tuyo, no
ves el de los demás).

## Rate limiting

Además del límite general: empezar conversaciones, 5 por minuto (lo que más
se presta al spam a desconocidos); mandar mensajes, 40 por minuto. Ver
[backend-y-colas.md](./backend-y-colas.md).

## Pendiente: usuario con la app cerrada

Realtime depende de una conexión WebSocket activa. Si el destinatario
cerró la app, el mensaje se guarda bien en Postgres pero no le llega
ningún aviso.

**Solución prevista**: se reutiliza el sistema de colas definido para el
resto de las notificaciones (ver [backend-y-colas.md](./backend-y-colas.md)):

1. El backend guarda el mensaje → Realtime lo entrega al instante si el
   destinatario está conectado.
2. Además, encola un job `notify-new-message` en BullMQ.
3. El worker decide si corresponde notificar y dispara una push vía
   **Expo Push Notifications**.

BullMQ no es estrictamente necesario para esto (mandar una push es un
`POST` a Expo): aporta reintentos y que la push no se pierda si el proceso
se reinicia. Si las push llegan antes que BullMQ, un paso intermedio
razonable es llamar a Expo directo desde el backend después de guardar el
mensaje, sin esperar la respuesta. Con o sin cola, las push necesitan
configuración externa (proyecto en EAS y, para Android, credenciales de
Firebase en Expo) y un build de desarrollo para probarse.
