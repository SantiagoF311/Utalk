import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { ProfileEntity } from '../domain/profile.entity.js';
import type { ProfileRole } from '../domain/profile.entity.js';
import type { NewProfile, ProfileRepository } from '../domain/profile.repository.js';

interface ProfileRow {
  id: string;
  username: string;
  university_id: string;
  role: ProfileRole;
  created_at: string;
}

function toEntity(row: ProfileRow): ProfileEntity {
  return new ProfileEntity(
    row.id,
    row.username,
    row.university_id,
    row.role,
    new Date(row.created_at),
  );
}

@Injectable()
export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async create(profile: NewProfile): Promise<ProfileEntity> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .insert({
        id: profile.id,
        username: profile.username,
        university_id: profile.universityId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async findById(id: string): Promise<ProfileEntity | null> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async findByUsername(username: string): Promise<ProfileEntity | null> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select()
      .eq('username', username)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }
}
