import { Injectable } from '@nestjs/common';
import type { Author } from '@utalk/shared';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { BlockEntity } from '../domain/block.entity.js';
import type { BlockRepository, BlockWithUser } from '../domain/block.repository.js';

interface BlockRow {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

interface BlockWithUserRow extends BlockRow {
  blocked: Author;
}

// Se nombra la FK porque user_blocks y profiles se relacionan dos veces
// (blocker_id y blocked_id).
const WITH_BLOCKED_USER =
  '*, blocked:profiles!user_blocks_blocked_id_fkey(id, username, university:universities(id, slug, name))';

function toEntity(row: BlockRow): BlockEntity {
  return new BlockEntity(row.blocker_id, row.blocked_id, new Date(row.created_at));
}

@Injectable()
export class SupabaseBlockRepository implements BlockRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async add(blockerId: string, blockedId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('user_blocks')
      .upsert(
        { blocker_id: blockerId, blocked_id: blockedId },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      );

    if (error) throw new Error(error.message);
  }

  async remove(blockerId: string, blockedId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('user_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);

    if (error) throw new Error(error.message);
  }

  async findBetween(userId: string, otherUserId: string): Promise<BlockEntity | null> {
    // Los ids llegan validados como UUID (ParseUUIDPipe / Zod / el JWT), así
    // que es seguro ponerlos dentro del filtro.
    const { data, error } = await this.supabase.client
      .from('user_blocks')
      .select()
      .or(
        `and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),` +
          `and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`,
      )
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data as BlockRow) : null;
  }

  async findByBlocker(blockerId: string): Promise<BlockWithUser[]> {
    const { data, error } = await this.supabase.client
      .from('user_blocks')
      .select(WITH_BLOCKED_USER)
      .eq('blocker_id', blockerId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data as unknown as BlockWithUserRow[]).map((row) => ({
      block: toEntity(row),
      user: row.blocked,
    }));
  }
}
