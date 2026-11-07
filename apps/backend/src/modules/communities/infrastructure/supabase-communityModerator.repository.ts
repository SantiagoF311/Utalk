import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import type { CommunityModeratorRepository } from '../domain/communityModerator.repository.js';

// Las filas se crean por trigger al crear una comunidad (el creador es el primer
// moderador); agregar/quitar mods llega con el flujo de moderación.
@Injectable()
export class SupabaseCommunityModeratorRepository implements CommunityModeratorRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async isModerator(communityId: string, userId: string): Promise<boolean> {
    const { count, error } = await this.supabase.client
      .from('community_moderators')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return (count ?? 0) > 0;
  }
}
