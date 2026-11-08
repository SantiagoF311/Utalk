import { USERNAME_CHANGE_COOLDOWN_DAYS } from '@utalk/shared';

export type ProfileRole = 'user' | 'admin';

const DAY_MS = 24 * 60 * 60 * 1000;

export class ProfileEntity {
  constructor(
    readonly id: string,
    readonly username: string,
    readonly universityId: string,
    readonly role: ProfileRole,
    readonly isPrivate: boolean,
    readonly usernameChangedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  belongsTo(userId: string): boolean {
    return this.id === userId;
  }

  belongsToUniversity(universityId: string): boolean {
    return this.universityId === universityId;
  }

  isAdmin(): boolean {
    return this.role === 'admin';
  }

  // Desde cuándo puede volver a cambiar el apodo (null = ya puede: nunca lo
  // cambió).
  nextUsernameChangeAt(): Date | null {
    if (!this.usernameChangedAt) return null;
    return new Date(this.usernameChangedAt.getTime() + USERNAME_CHANGE_COOLDOWN_DAYS * DAY_MS);
  }

  canChangeUsername(now: Date): boolean {
    const next = this.nextUsernameChangeAt();
    return next === null || now >= next;
  }

  // Su historial (publicaciones, comentarios, contadores): lo ve cualquiera
  // si el perfil es público, y siempre él mismo.
  historyVisibleTo(viewerId: string): boolean {
    return !this.isPrivate || this.belongsTo(viewerId);
  }
}
