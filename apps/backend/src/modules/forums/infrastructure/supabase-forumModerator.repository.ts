import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import type { ForumModeratorRepository } from '../domain/forumModerator.repository.js';

// Las filas se crean por trigger al crear un foro (el creador es el primer
// moderador); agregar/quitar mods llega con el flujo de moderación.
@Injectable()
export class SupabaseForumModeratorRepository implements ForumModeratorRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async isModerator(forumId: string, userId: string): Promise<boolean> {
    const { count, error } = await this.supabase.client
      .from('forum_moderators')
      .select('*', { count: 'exact', head: true })
      .eq('forum_id', forumId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return (count ?? 0) > 0;
  }
}
