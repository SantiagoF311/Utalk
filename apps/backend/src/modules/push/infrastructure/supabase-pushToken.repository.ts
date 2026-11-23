import { Injectable } from '@nestjs/common';
import type { PushPlatform } from '@utalk/shared';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { PushTokenEntity } from '../domain/pushToken.entity.js';
import type { PushTokenRepository } from '../domain/pushToken.repository.js';

interface PushTokenRow {
  token: string;
  user_id: string;
  platform: PushPlatform;
  updated_at: string;
}

function toEntity(row: PushTokenRow): PushTokenEntity {
  return new PushTokenEntity(row.token, row.user_id, row.platform, new Date(row.updated_at));
}

@Injectable()
export class SupabasePushTokenRepository implements PushTokenRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async upsert(token: string, userId: string, platform: PushPlatform): Promise<void> {
    const { error } = await this.supabase.client
      .from('push_tokens')
      .upsert(
        { token, user_id: userId, platform, updated_at: new Date().toISOString() },
        { onConflict: 'token' },
      );

    if (error) throw new Error(error.message);
  }

  async deleteOwned(token: string, userId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('push_tokens')
      .delete()
      .eq('token', token)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  }

  async findByUser(userId: string): Promise<PushTokenEntity[]> {
    const { data, error } = await this.supabase.client
      .from('push_tokens')
      .select('token, user_id, platform, updated_at')
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return (data as PushTokenRow[]).map(toEntity);
  }

  async findByUsers(userIds: string[]): Promise<PushTokenEntity[]> {
    if (userIds.length === 0) return [];

    const { data, error } = await this.supabase.client
      .from('push_tokens')
      .select('token, user_id, platform, updated_at')
      .in('user_id', userIds);

    if (error) throw new Error(error.message);
    return (data as PushTokenRow[]).map(toEntity);
  }

  async deleteMany(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;

    const { error } = await this.supabase.client.from('push_tokens').delete().in('token', tokens);

    if (error) throw new Error(error.message);
  }
}
