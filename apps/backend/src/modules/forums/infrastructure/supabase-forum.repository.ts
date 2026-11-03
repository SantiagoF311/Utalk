import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/appException.js';
import { isUniqueViolation } from '../../../common/databaseError.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { ForumEntity } from '../domain/forum.entity.js';
import type { ForumChanges, ForumRepository, NewForum } from '../domain/forum.repository.js';

interface ForumRow {
  id: string;
  panel_id: string;
  slug: string;
  name: string;
  created_by: string;
  created_at: string;
}

function toEntity(row: ForumRow): ForumEntity {
  return new ForumEntity(
    row.id,
    row.panel_id,
    row.slug,
    row.name,
    row.created_by,
    new Date(row.created_at),
  );
}

@Injectable()
export class SupabaseForumRepository implements ForumRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async create(forum: NewForum): Promise<ForumEntity> {
    const { data, error } = await this.supabase.client
      .from('forums')
      .insert({
        panel_id: forum.panelId,
        slug: forum.slug,
        name: forum.name,
        created_by: forum.createdBy,
      })
      .select()
      .single();

    // Dos creaciones simultáneas pueden pasar el chequeo del service; la
    // constraint unique(panel_id, slug) frena a la segunda.
    if (error && isUniqueViolation(error, 'forums_panel_id_slug_key')) {
      throw new AppException(
        'FORUM_SLUG_TAKEN',
        `Forum slug "${forum.slug}" is already taken in this panel`,
      );
    }
    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async findById(id: string): Promise<ForumEntity | null> {
    const { data, error } = await this.supabase.client
      .from('forums')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async findByPanelId(panelId: string): Promise<ForumEntity[]> {
    const { data, error } = await this.supabase.client
      .from('forums')
      .select()
      .eq('panel_id', panelId)
      .order('name');

    if (error) throw new Error(error.message);
    return (data as ForumRow[]).map(toEntity);
  }

  async findByPanelAndSlug(panelId: string, slug: string): Promise<ForumEntity | null> {
    const { data, error } = await this.supabase.client
      .from('forums')
      .select()
      .eq('panel_id', panelId)
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async update(id: string, changes: ForumChanges): Promise<ForumEntity> {
    const { data, error } = await this.supabase.client
      .from('forums')
      .update({ name: changes.name })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('forums').delete().eq('id', id);

    if (error) throw new Error(error.message);
  }
}
