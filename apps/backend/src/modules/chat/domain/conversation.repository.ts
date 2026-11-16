import type { Author } from '@utalk/shared';
import { ConversationEntity } from './conversation.entity.js';

// Una conversación como la ve uno de sus participantes: con la otra persona,
// el último mensaje y cuántos no leyó.
export interface ConversationSummary {
  conversation: ConversationEntity;
  otherUser: Author;
  lastMessage: { body: string; senderId: string; createdAt: Date } | null;
  unreadCount: number;
}

export interface ConversationRepository {
  findById(id: string): Promise<ConversationEntity | null>;
  // La conversación entre esos dos (el orden no importa), o null.
  findBetween(userId: string, otherUserId: string): Promise<ConversationEntity | null>;
  // Crea la conversación con su primer mensaje, en una sola transacción.
  // Si otra request la creó al mismo tiempo, lanza CONFLICT.
  start(
    senderId: string,
    recipientId: string,
    body: string,
  ): Promise<{ conversationId: string; messageId: string }>;
  accept(id: string): Promise<void>;
  // Las conversaciones del usuario (o solo `conversationId`), sin las de
  // alguien que él bloqueó, de la más reciente a la más vieja.
  findSummaries(userId: string, conversationId?: string): Promise<ConversationSummary[]>;
}

export const CONVERSATION_REPOSITORY = Symbol('CONVERSATION_REPOSITORY');
