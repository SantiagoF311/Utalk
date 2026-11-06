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

  // Verifica el JWT localmente: el proyecto firma con claves asimétricas
  // (ES256), así que getClaims() valida firma y vencimiento contra la clave
  // pública (JWKS, que descarga una vez y cachea) sin llamar a Supabase en
  // cada request. getUser() hacía un viaje por red por request.
  // Costo aceptado: un token revocado (logout, usuario borrado) sigue siendo
  // válido hasta que vence (1 h por defecto en Supabase).
  async getUserIdByAccessToken(accessToken: string): Promise<string | null> {
    const { data, error } = await this.supabase.client.auth.getClaims(accessToken);
    if (error || !data) return null;
    // Solo tokens de sesión de usuario; nunca los de otros roles.
    if (data.claims.role !== 'authenticated' || !data.claims.sub) return null;
    return data.claims.sub;
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
