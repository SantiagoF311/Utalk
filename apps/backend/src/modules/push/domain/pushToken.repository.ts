import type { PushPlatform } from '@utalk/shared';
import { PushTokenEntity } from './pushToken.entity.js';

export interface PushTokenRepository {
  // Crea el token o, si ya existía (de esta u otra cuenta en el mismo
  // celular), lo pasa a este usuario. Un celular avisa de una sola cuenta.
  upsert(token: string, userId: string, platform: PushPlatform): Promise<void>;
  // Solo si es de ese usuario: nadie borra el token de otro.
  deleteOwned(token: string, userId: string): Promise<void>;
  findByUser(userId: string): Promise<PushTokenEntity[]>;
  // Los de todos esos usuarios (para un aviso a muchos, ej. un post nuevo).
  findByUsers(userIds: string[]): Promise<PushTokenEntity[]>;
  // Los que Expo dice que ya no existen (desinstalaron la app).
  deleteMany(tokens: string[]): Promise<void>;
}

export const PUSH_TOKEN_REPOSITORY = Symbol('PUSH_TOKEN_REPOSITORY');
