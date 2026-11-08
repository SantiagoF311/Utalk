import type { ProfileStats } from '@utalk/shared';
import { ProfileEntity } from './profile.entity.js';

export interface NewProfile {
  id: string;
  username: string;
  universityId: string;
}

// Solo se cambia lo que viene definido.
export interface ProfileChanges {
  username?: string;
  usernameChangedAt?: Date;
  isPrivate?: boolean;
}

export interface ProfileRepository {
  create(profile: NewProfile): Promise<ProfileEntity>;
  findById(id: string): Promise<ProfileEntity | null>;
  findByUsername(username: string): Promise<ProfileEntity | null>;
  // Si el apodo nuevo ya lo tomó otro (dos cambios simultáneos), lanza
  // USERNAME_TAKEN.
  update(id: string, changes: ProfileChanges): Promise<ProfileEntity>;
  findStats(id: string): Promise<ProfileStats>;
}

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');
