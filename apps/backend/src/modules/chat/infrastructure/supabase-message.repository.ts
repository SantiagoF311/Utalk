import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AppException } from '../../../common/appException.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { MessageEntity } from '../domain/message.entity.js';
import type {
  MessagePage,
  MessagePageQuery,
  MessageRepository,
  NewMessage,
} from '../domain/message.repository.js';

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

function toEntity(row: MessageRow): MessageEntity {
  return new MessageEntity(
    row.id,
    row.conversation_id,
    row.sender_id,
    row.body,
    row.read_at ? new Date(row.read_at) : null,
    new Date(row.created_at),
  );
}

// Cursor: fecha + id del último mensaje de la página (el id desempata los
// creados en el mismo instante). created_at va tal cual viene de Postgres,
// con microsegundos.
const cursorSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

function encodeCursor(row: MessageRow): string {
  return Buffer.from(JSON.stringify({ createdAt: row.created_at, id: row.id })).toString(
    'base64url',
  );
}

// El cursor viene del cliente y termina dentro de un filtro `.or(...)`: se
// valida estricto para que no se pueda inyectar otra condición.
function decodeCursor(raw: string): z.infer<typeof cursorSchema> {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(raw, 'base64url').toString()));
  } catch {
    throw new AppException('INVALID_CURSOR', 'Invalid cursor');
  }
}

@Injectable()
export class SupabaseMessageRepository implements MessageRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async create(message: NewMessage): Promise<MessageEntity> {
    const { data, error } = await this.supabase.client
      .from('messages')
      .insert({
        conversation_id: message.conversationId,
        sender_id: message.senderId,
        body: message.body,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEntity(data as MessageRow);
  }

  async findById(id: string): Promise<MessageEntity | null> {
    const { data, error } = await this.supabase.client
      .from('messages')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data as MessageRow) : null;
  }

  async findPage(query: MessagePageQuery): Promise<MessagePage> {
    let request = this.supabase.client
      .from('messages')
      .select()
      .eq('conversation_id', query.conversationId);

    if (query.cursor) {
      const { createdAt, id } = decodeCursor(query.cursor);
      request = request.or(
        `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt.${id})`,
      );
    }

    // Se pide uno de más solo para saber si hay página siguiente.
    const { data, error } = await request
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(query.limit + 1);

    if (error) throw new Error(error.message);
    const rows = data as MessageRow[];
    const pageRows = rows.slice(0, query.limit);
    const last = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map(toEntity),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
    };
  }

  async markRead(conversationId: string, readerId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', readerId)
      .is('read_at', null);

    if (error) throw new Error(error.message);
  }
}
