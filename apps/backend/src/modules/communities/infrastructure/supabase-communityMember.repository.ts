import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import type { CommunityMemberRepository } from '../domain/communityMember.repository.js';

@Injectable()
export class SupabaseCommunityMemberRepository implements CommunityMemberRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async add(communityId: string, userId: string): Promise<void> {
    // Si ya era miembro, la PK choca y se ignora: unirse es idempotente.
    const { error } = await this.supabase.client
      .from('community_members')
      .upsert(
        { community_id: communityId, user_id: userId },
        { onConflict: 'community_id,user_id', ignoreDuplicates: true },
      );

    if (error) throw new Error(error.message);
  }

  async remove(communityId: string, userId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  }

  async findJoinedByUser(communityIds: string[], userId: string): Promise<Set<string>> {
    if (communityIds.length === 0) {
      return new Set();
    }

    const { data, error } = await this.supabase.client
      .from('community_members')
      .select('community_id')
      .eq('user_id', userId)
      .in('community_id', communityIds);

    if (error) throw new Error(error.message);
    return new Set((data as { community_id: string }[]).map((row) => row.community_id));
  }
}
