import type { AuthSession } from '@utalk/shared';

export interface AuthRepository {
  getEmailByUserId(userId: string): Promise<string | null>;
  getUserIdByAccessToken(accessToken: string): Promise<string | null>;
  // null si las credenciales no son válidas.
  signInWithPassword(email: string, password: string): Promise<AuthSession | null>;
}

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');
