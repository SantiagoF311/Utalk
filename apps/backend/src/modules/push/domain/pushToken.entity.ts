import type { PushPlatform } from '@utalk/shared';

// Un celular con la app y sesión: a dónde mandarle los avisos a su dueño.
export class PushTokenEntity {
  constructor(
    readonly token: string,
    readonly userId: string,
    readonly platform: PushPlatform,
    readonly updatedAt: Date,
  ) {}

  belongsTo(userId: string): boolean {
    return this.userId === userId;
  }
}
