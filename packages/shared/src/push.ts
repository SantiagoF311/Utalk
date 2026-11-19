import { z } from 'zod';

// Push del celular (ver docs/chat-realtime.md): el mobile registra su token
// de Expo al entrar y lo borra al cerrar sesión; el backend manda los avisos
// por el servicio de push de Expo.

// Formato de los tokens de Expo: `ExponentPushToken[...]` (o `ExpoPushToken[...]`).
export const expoPushTokenSchema = z
  .string()
  .regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/, 'Not an Expo push token');

export const PUSH_PLATFORMS = ['ios', 'android'] as const;

export const pushPlatformSchema = z.enum(PUSH_PLATFORMS);

export type PushPlatform = z.infer<typeof pushPlatformSchema>;

export const registerPushTokenSchema = z.object({
  token: expoPushTokenSchema,
  platform: pushPlatformSchema,
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

// Cuánto del mensaje se ve en el aviso (en una conversación ya aceptada).
export const PUSH_PREVIEW_MAX_LENGTH = 120;

// Payload del job `notify-new-message` (cola de BullMQ `push`). Lleva lo que
// el aviso muestra, así el worker no tiene que volver a leer el chat.
// `preview` null = solicitud de mensaje: el aviso no muestra el texto.
export const notifyNewMessageJobSchema = z.object({
  recipientId: z.uuid(),
  conversationId: z.uuid(),
  senderUsername: z.string().min(1),
  preview: z.string().max(PUSH_PREVIEW_MAX_LENGTH).nullable(),
});

export type NotifyNewMessageJob = z.infer<typeof notifyNewMessageJobSchema>;

// Lo que viaja en `data` de la notificación: a qué conversación lleva tocarla.
export const pushMessageDataSchema = z.object({ conversationId: z.uuid() });

export type PushMessageData = z.infer<typeof pushMessageDataSchema>;
