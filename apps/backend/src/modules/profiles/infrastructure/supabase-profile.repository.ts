import { Injectable } from '@nestjs/common';
import type { ProfileStats } from '@utalk/shared';
import { AppException } from '../../../common/appException.js';
import { isUniqueViolation } from '../../../common/databaseError.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { ProfileEntity } from '../domain/profile.entity.js';
import type { ProfileRole } from '../domain/profile.entity.js';
import type {
  NewProfile,
  ProfileChanges,
  ProfileRepository,
} from '../domain/profile.repository.js';

interface ProfileRow {
  id: string;
  username: string;
  university_id: string;
  role: ProfileRole;
  is_private: boolean;
  username_changed_at: string | null;
  created_at: string;
}

function toEntity(row: ProfileRow): ProfileEntity {
  return new ProfileEntity(
    row.id,
    row.username,
    row.university_id,
    row.role,
    row.is_private,
    row.username_changed_at ? new Date(row.username_changed_at) : null,
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

    // Dos registros simultáneos pueden pasar el chequeo del service; la
    // constraint unique de la base frena al segundo.
    if (error && isUniqueViolation(error, 'profiles_username_key')) {
      throw new AppException('USERNAME_TAKEN', `Username "${profile.username}" is already taken`);
    }
    // El id del perfil es el del usuario de Auth: chocar con la primary key es
    // completar el registro dos veces (reintento de la app, doble toque).
    if (error && isUniqueViolation(error, 'profiles_pkey')) {
      throw new AppException('PROFILE_ALREADY_EXISTS', `User ${profile.id} already has a profile`);
    }
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

  async update(id: string, changes: ProfileChanges): Promise<ProfileEntity> {
    // Los campos undefined se omiten al serializar: solo cambia lo que vino.
    const { data, error } = await this.supabase.client
      .from('profiles')
      .update({
        username: changes.username,
        username_changed_at: changes.usernameChangedAt?.toISOString(),
        is_private: changes.isPrivate,
      })
      .eq('id', id)
      .select()
      .single();

    // Dos cambios simultáneos al mismo apodo pueden pasar el chequeo del
    // service; la constraint unique frena al segundo.
    if (error && isUniqueViolation(error, 'profiles_username_key')) {
      throw new AppException('USERNAME_TAKEN', `Username "${changes.username}" is already taken`);
    }
    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async findStats(id: string): Promise<ProfileStats> {
    const { data, error } = await this.supabase.client
      .rpc('profile_stats', { p_user_id: id })
      .single();

    if (error) throw new Error(error.message);
    const row = data as { post_count: number; comment_count: number; karma: number };
    return { karma: row.karma, postCount: row.post_count, commentCount: row.comment_count };
  }
}
