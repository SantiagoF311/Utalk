import { z } from 'zod';
import { authorSchema } from './profile.ts';

export const MESSAGE_MAX_LENGTH = 2000;

const messageBodySchema = z.string().trim().min(1).max(MESSAGE_MAX_LENGTH);

// Un mensaje. `senderId` (y no un "es mío") para que tenga la misma forma que
// la fila que llega por Realtime: el mobile compara con su propio id.
export const messageViewSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  senderId: z.uuid(),
  body: z.string(),
  // Cuándo lo leyó el otro ("Visto"); null = no lo leyó.
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type MessageView = z.infer<typeof messageViewSchema>;

// Estado de la conversación para quien mira:
// - accepted: se puede escribir libremente.
// - request_received: alguien te escribió y todavía no respondiste. Si
//   respondes, la aceptas.
// - request_sent: escribiste primero y esperas que la otra persona responda;
//   hasta entonces no puedes mandar otro mensaje.
export const CONVERSATION_STATUSES = ['accepted', 'request_received', 'request_sent'] as const;

export const conversationStatusSchema = z.enum(CONVERSATION_STATUSES);

export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

export const conversationViewSchema = z.object({
  id: z.uuid(),
  // La otra persona: solo su apodo y su universidad (como en todo el resto).
  otherUser: authorSchema,
  status: conversationStatusSchema,
  lastMessage: z
    .object({
      body: z.string(),
      senderId: z.uuid(),
      createdAt: z.iso.datetime(),
    })
    .nullable(),
  // Mensajes de la otra persona que quien mira todavía no leyó.
  unreadCount: z.number().int().nonnegative(),
  // Quien mira bloqueó a la otra persona: la conversación sigue en su lista,
  // pero nadie puede escribir hasta que la desbloquee.
  blockedByMe: z.boolean(),
  // La otra persona bloqueó a quien mira: no puede escribirle (como Reddit,
  // el bloqueado se entera).
  blockedByOther: z.boolean(),
  lastMessageAt: z.iso.datetime(),
});

export type ConversationView = z.infer<typeof conversationViewSchema>;

// POST /conversations: escribirle a alguien por primera vez. Si ya hay una
// conversación con esa persona, el mensaje va a esa.
export const startConversationSchema = z.object({
  recipientId: z.uuid(),
  body: messageBodySchema,
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;

export const startConversationResultSchema = z.object({
  conversation: conversationViewSchema,
  message: messageViewSchema,
});

export type StartConversationResult = z.infer<typeof startConversationResultSchema>;

// POST /conversations/:id/messages
export const sendMessageSchema = z.object({
  body: messageBodySchema,
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// GET /conversations/:id/messages?cursor=…&limit=…, del más nuevo al más viejo.
export const messagePageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type MessagePageQuery = z.infer<typeof messagePageQuerySchema>;

export const messagePageSchema = z.object({
  items: z.array(messageViewSchema),
  nextCursor: z.string().nullable(),
});

export type MessagePage = z.infer<typeof messagePageSchema>;
