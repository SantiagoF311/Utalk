import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/appException.js';
import { isUniqueViolation } from '../../../common/databaseError.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { PanelEntity } from '../domain/panel.entity.js';
import type { NewPanel, PanelChanges, PanelRepository } from '../domain/panel.repository.js';

interface PanelRow {
  id: string;
  university_id: string | null;
  slug: string;
  name: string;
  created_at: string;
}

function toEntity(row: PanelRow): PanelEntity {
  return new PanelEntity(row.id, row.university_id, row.slug, row.name, new Date(row.created_at));
}

@Injectable()
export class SupabasePanelRepository implements PanelRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async create(panel: NewPanel): Promise<PanelEntity> {
    const { data, error } = await this.supabase.client
      .from('panels')
      .insert({
        university_id: panel.universityId,
        slug: panel.slug,
        name: panel.name,
      })
      .select()
      .single();

    // Mismo caso que en el service, pero frenado por la base (requests
    // simultáneos). Hay dos constraints unique: se distingue por nombre.
    if (error && isUniqueViolation(error, 'panels_university_id_key')) {
      throw new AppException(
        'UNIVERSITY_ALREADY_HAS_PANEL',
        `University ${panel.universityId} already has a panel`,
      );
    }
    if (error && isUniqueViolation(error, 'panels_slug_key')) {
      throw new AppException('PANEL_SLUG_TAKEN', `Panel slug "${panel.slug}" is already taken`);
    }
    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async findAll(): Promise<PanelEntity[]> {
    const { data, error } = await this.supabase.client.from('panels').select().order('name');

    if (error) throw new Error(error.message);
    return (data as PanelRow[]).map(toEntity);
  }

  async findById(id: string): Promise<PanelEntity | null> {
    const { data, error } = await this.supabase.client
      .from('panels')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async findBySlug(slug: string): Promise<PanelEntity | null> {
    const { data, error } = await this.supabase.client
      .from('panels')
      .select()
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async findByUniversityId(universityId: string): Promise<PanelEntity | null> {
    const { data, error } = await this.supabase.client
      .from('panels')
      .select()
      .eq('university_id', universityId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async update(id: string, changes: PanelChanges): Promise<PanelEntity> {
    const { data, error } = await this.supabase.client
      .from('panels')
      .update({ name: changes.name })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('panels').delete().eq('id', id);

    if (error) throw new Error(error.message);
  }
}
