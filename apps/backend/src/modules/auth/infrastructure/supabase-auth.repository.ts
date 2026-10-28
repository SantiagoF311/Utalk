import { Injectable } from '@nestjs/common';
import type { AuthSession } from '@utalk/shared';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import type { AuthRepository } from '../domain/auth.repository.js';

@Injectable()
export class SupabaseAuthRepository implements AuthRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async getEmailByUserId(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase.client.auth.admin.getUserById(userId);
    if (error) throw new Error(error.message);
    return data.user?.email ?? null;
  }

  async getUserIdByAccessToken(accessToken: string): Promise<string | null> {
    const { data, error } = await this.supabase.client.auth.getUser(accessToken);
    if (error) return null;
    return data.user.id;
  }

  async signInWithPassword(email: string, password: string): Promise<AuthSession | null> {
    const { data, error } = await this.supabase
      .createPublicClient()
      .auth.signInWithPassword({ email, password });

    // 400 = credenciales inválidas o correo sin confirmar; el resto es un
    // fallo real (red, rate limit de Supabase, etc.).
    if (error?.status === 400) return null;
    if (error) throw new Error(error.message);

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }
}
