import { MessageEntity } from './message.entity.js';

export interface NewMessage {
  conversationId: string;
  senderId: string;
  body: string;
}

export interface MessagePageQuery {
  conversationId: string;
  cursor?: string;
  limit: number;
}

export interface MessagePage {
  // Del más nuevo al más viejo.
  items: MessageEntity[];
  nextCursor: string | null;
}

export interface MessageRepository {
  create(message: NewMessage): Promise<MessageEntity>;
  findById(id: string): Promise<MessageEntity | null>;
  findPage(query: MessagePageQuery): Promise<MessagePage>;
  // Marca como leídos todos los mensajes de la conversación que le mandaron
  // a `readerId` y todavía no leyó.
  markRead(conversationId: string, readerId: string): Promise<void>;
}

export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');
