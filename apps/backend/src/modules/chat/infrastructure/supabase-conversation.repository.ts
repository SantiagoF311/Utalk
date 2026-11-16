import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/appException.js';
import { isUniqueViolation } from '../../../common/databaseError.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { ConversationEntity } from '../domain/conversation.entity.js';
import type {
  ConversationRepository,
  ConversationSummary,
} from '../domain/conversation.repository.js';

interface ConversationRow {
  id: string;
  user_a: string;
  user_b: string;
  initiated_by: string;
  accepted_at: string | null;
  last_message_at: string;
  created_at: string;
}

// Fila de la función SQL conversation_summaries (migración `chat`).
interface SummaryRow extends ConversationRow {
  other_id: string;
  other_username: string;
  other_university_id: string;
  other_university_slug: string;
  other_university_name: string;
  last_body: string | null;
  last_sender_id: string | null;
  last_created_at: string | null;
  unread_count: number;
}

function toEntity(row: ConversationRow): ConversationEntity {
  return new ConversationEntity(
    row.id,
    row.user_a,
    row.user_b,
    row.initiated_by,
    row.accepted_at ? new Date(row.accepted_at) : null,
    new Date(row.last_message_at),
    new Date(row.created_at),
  );
}

function toSummary(row: SummaryRow): ConversationSummary {
  return {
    conversation: toEntity(row),
    otherUser: {
      id: row.other_id,
      username: row.other_username,
      university: {
        id: row.other_university_id,
        slug: row.other_university_slug,
        name: row.other_university_name,
      },
    },
    lastMessage:
      row.last_body !== null && row.last_sender_id !== null && row.last_created_at !== null
        ? {
            body: row.last_body,
            senderId: row.last_sender_id,
            createdAt: new Date(row.last_created_at),
          }
        : null,
    unreadCount: row.unread_count,
  };
}

@Injectable()
export class SupabaseConversationRepository implements ConversationRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findById(id: string): Promise<ConversationEntity | null> {
    const { data, error } = await this.supabase.client
      .from('conversations')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data as ConversationRow) : null;
  }

  async findBetween(userId: string, otherUserId: string): Promise<ConversationEntity | null> {
    // Se guardan ordenados (user_a < user_b): se busca igual.
    const [userA, userB] = userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];
    const { data, error } = await this.supabase.client
      .from('conversations')
      .select()
      .eq('user_a', userA)
      .eq('user_b', userB)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data as ConversationRow) : null;
  }

  async start(
    senderId: string,
    recipientId: string,
    body: string,
  ): Promise<{ conversationId: string; messageId: string }> {
    const { data, error } = await this.supabase.client
      .rpc('start_conversation', { p_sender: senderId, p_recipient: recipientId, p_body: body })
      .single();

    // Dos primeros mensajes simultáneos entre los mismos dos: el segundo
    // choca con el unique del par.
    if (error && isUniqueViolation(error, 'conversations_one_per_pair')) {
      throw new AppException('CONFLICT', 'A conversation between these users already exists');
    }
    if (error) throw new Error(error.message);
    const row = data as { conversation_id: string; message_id: string };
    return { conversationId: row.conversation_id, messageId: row.message_id };
  }

  async accept(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('conversations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', id)
      .is('accepted_at', null);

    if (error) throw new Error(error.message);
  }

  async findSummaries(userId: string, conversationId?: string): Promise<ConversationSummary[]> {
    const { data, error } = await this.supabase.client.rpc('conversation_summaries', {
      p_user_id: userId,
      p_conversation_id: conversationId ?? null,
    });

    if (error) throw new Error(error.message);
    return (data as SummaryRow[]).map(toSummary);
  }
}
