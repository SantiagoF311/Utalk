import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { UniversityEntity } from '../domain/university.entity.js';
import type { UniversityRepository } from '../domain/university.repository.js';

interface UniversityRow {
  id: string;
  slug: string;
  name: string;
  email_domain: string;
  created_at: string;
}

function toEntity(row: UniversityRow): UniversityEntity {
  return new UniversityEntity(
    row.id,
    row.slug,
    row.name,
    row.email_domain,
    new Date(row.created_at),
  );
}

@Injectable()
export class SupabaseUniversityRepository implements UniversityRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(): Promise<UniversityEntity[]> {
    const { data, error } = await this.supabase.client.from('universities').select().order('name');

    if (error) throw new Error(error.message);
    return (data as UniversityRow[]).map(toEntity);
  }

  async findById(id: string): Promise<UniversityEntity | null> {
    const { data, error } = await this.supabase.client
      .from('universities')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async findBySlug(slug: string): Promise<UniversityEntity | null> {
    const { data, error } = await this.supabase.client
      .from('universities')
      .select()
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async findByEmailDomain(domain: string): Promise<UniversityEntity | null> {
    const { data, error } = await this.supabase.client
      .from('universities')
      .select()
      .eq('email_domain', domain.toLowerCase())
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }
}
