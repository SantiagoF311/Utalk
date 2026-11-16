import type { ConversationView, MessageView } from '@utalk/shared';
import type { ConversationSummary } from './domain/conversation.repository.js';
import type { MessageEntity } from './domain/message.entity.js';

// `status` depende de quien mira (quién la mandó y quién la recibió).
export function toConversationView(
  { conversation, otherUser, lastMessage, unreadCount }: ConversationSummary,
  viewerId: string,
): ConversationView {
  return {
    id: conversation.id,
    otherUser,
    status: conversation.statusFor(viewerId),
    lastMessage: lastMessage
      ? {
          body: lastMessage.body,
          senderId: lastMessage.senderId,
          createdAt: lastMessage.createdAt.toISOString(),
        }
      : null,
    unreadCount,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
  };
}

export function toMessageView(message: MessageEntity): MessageView {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
  };
}
