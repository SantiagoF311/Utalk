# Chat en tiempo real

## Alcance

Chats 1 a 1 (sin grupos), con: mensajes en tiempo real, historial,
indicador de "usuario está escribiendo...", y marcas de leído/entregado.

## Qué resuelve Supabase Realtime solo (sin infraestructura adicional)

Todo lo que ocurre **mientras ambos usuarios están conectados**:

- **Mensajes en tiempo real**: insertar una fila en la tabla `messages` es
  suficiente — los clientes suscritos a esa tabla/canal reciben el insert
  al instante vía WebSocket.
- **Historial**: query normal a Postgres
  (`SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at`).
- **Marcas de leído/entregado**: un campo `read_at` en la fila del mensaje,
  actualizado con `UPDATE` — el otro cliente recibe el cambio como evento
  de update en su suscripción.
- **"Usuario está escribiendo..."**: se usa **Presence**, una feature de
  Supabase Realtime distinta de las suscripciones a tablas — permite
  broadcastear estado efímero entre clientes conectados al mismo canal,
  sin persistir nada en la base de datos (encaja porque ese estado es
  transitorio por naturaleza).

## Dónde Realtime no alcanza: usuario con la app cerrada

Realtime depende de una conexión WebSocket activa. Si el destinatario
cerró la app completamente, no hay ninguna conexión escuchando — el
mensaje se guarda bien en Postgres, pero no llega en tiempo real, y no se
dispara ninguna notificación automáticamente solo por el insert.

**Solución**: se reutiliza el mismo sistema de colas ya definido para el
resto de las notificaciones (ver
[backend-y-colas.md](./backend-y-colas.md)):

1. Se inserta el mensaje → Realtime lo entrega al instante si el
   destinatario está conectado.
2. Además, se encola un job `notify-new-message` en BullMQ.
3. El worker chequea si corresponde notificar (ej. si no hay sesión activa)
   y, si es así, dispara una push notification real vía **Expo Push
   Notifications** (el servicio nativo de Expo, sin necesidad de
   configurar Firebase Cloud Messaging manualmente).

No es una pieza de infraestructura nueva — es el mismo mecanismo de
notificaciones aplicado a un caso adicional.
