import { Injectable } from '@nestjs/common';
import type { CommunityTopic } from '@utalk/shared';
import { AppException } from '../../../common/appException.js';
import { isUniqueViolation } from '../../../common/databaseError.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { CommunityEntity } from '../domain/community.entity.js';
import type {
  CommunityChanges,
  CommunityRepository,
  NewCommunity,
} from '../domain/community.repository.js';

interface CommunityRow {
  id: string;
  panel_id: string;
  slug: string;
  name: string;
  description: string;
  topic: CommunityTopic;
  member_count: number;
  created_by: string;
  created_at: string;
}

function toEntity(row: CommunityRow): CommunityEntity {
  return new CommunityEntity(
    row.id,
    row.panel_id,
    row.slug,
    row.name,
    row.description,
    row.topic,
    row.member_count,
    row.created_by,
    new Date(row.created_at),
  );
}

@Injectable()
export class SupabaseCommunityRepository implements CommunityRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async create(community: NewCommunity): Promise<CommunityEntity> {
    const { data, error } = await this.supabase.client
      .from('communities')
      .insert({
        panel_id: community.panelId,
        slug: community.slug,
        name: community.name,
        description: community.description,
        topic: community.topic,
        created_by: community.createdBy,
      })
      .select()
      .single();

    // Dos creaciones simultáneas pueden pasar el chequeo del service; la
    // constraint unique(panel_id, slug) frena a la segunda.
    if (error && isUniqueViolation(error, 'communities_panel_id_slug_key')) {
      throw new AppException(
        'COMMUNITY_SLUG_TAKEN',
        `Community slug "${community.slug}" is already taken in this panel`,
      );
    }
    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async findById(id: string): Promise<CommunityEntity | null> {
    const { data, error } = await this.supabase.client
      .from('communities')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async findByPanelId(panelId: string): Promise<CommunityEntity[]> {
    const { data, error } = await this.supabase.client
      .from('communities')
      .select()
      .eq('panel_id', panelId)
      .order('name');

    if (error) throw new Error(error.message);
    return (data as CommunityRow[]).map(toEntity);
  }

  async findByPanelAndSlug(panelId: string, slug: string): Promise<CommunityEntity | null> {
    const { data, error } = await this.supabase.client
      .from('communities')
      .select()
      .eq('panel_id', panelId)
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async findModeratedBy(userId: string): Promise<CommunityEntity[]> {
    // Inner join: solo las comunidades con una fila de ese usuario.
    const { data, error } = await this.supabase.client
      .from('communities')
      .select('*, community_moderators!inner(user_id)')
      .eq('community_moderators.user_id', userId)
      .order('name');

    if (error) throw new Error(error.message);
    return (data as CommunityRow[]).map(toEntity);
  }

  async update(id: string, changes: CommunityChanges): Promise<CommunityEntity> {
    const { data, error } = await this.supabase.client
      .from('communities')
      // Los campos undefined se omiten al serializar: solo cambia lo que vino.
      .update({ name: changes.name, description: changes.description, topic: changes.topic })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('communities').delete().eq('id', id);

    if (error) throw new Error(error.message);
  }
}
