import { ProfileEntity } from './profile.entity.js';

export interface NewProfile {
  id: string;
  username: string;
  universityId: string;
}

export interface ProfileRepository {
  create(profile: NewProfile): Promise<ProfileEntity>;
  findById(id: string): Promise<ProfileEntity | null>;
  findByUsername(username: string): Promise<ProfileEntity | null>;
}

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');
