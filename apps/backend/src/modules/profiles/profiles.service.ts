import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProfileInput } from '@utalk/shared';
import { ProfileEntity } from './domain/profile.entity.js';
import { PROFILE_REPOSITORY } from './domain/profile.repository.js';
import type { ProfileRepository } from './domain/profile.repository.js';

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profileRepository: ProfileRepository,
  ) {}

  async create(userId: string, input: CreateProfileInput): Promise<ProfileEntity> {
    const existing = await this.profileRepository.findByUsername(input.username);
    if (existing) {
      throw new ConflictException(`Username "${input.username}" is already taken`);
    }

    return this.profileRepository.create({
      id: userId,
      username: input.username,
      universityId: input.universityId,
    });
  }

  async findById(id: string): Promise<ProfileEntity> {
    const profile = await this.profileRepository.findById(id);
    if (!profile) {
      throw new NotFoundException(`Profile ${id} not found`);
    }
    return profile;
  }

  async findByUsername(username: string): Promise<ProfileEntity | null> {
    return this.profileRepository.findByUsername(username);
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const profile = await this.profileRepository.findByUsername(username);
    return profile === null;
  }
}
