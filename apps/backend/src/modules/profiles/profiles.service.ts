import { Inject, Injectable } from '@nestjs/common';
import type { CreateProfileInput, PublicProfile } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { UniversitiesService } from '../universities/universities.service.js';
import { ProfileEntity } from './domain/profile.entity.js';
import { PROFILE_REPOSITORY } from './domain/profile.repository.js';
import type { ProfileRepository } from './domain/profile.repository.js';
import { toPublicProfileView } from './profile.view.js';

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profileRepository: ProfileRepository,
    private readonly universitiesService: UniversitiesService,
  ) {}

  async create(userId: string, input: CreateProfileInput): Promise<ProfileEntity> {
    const existing = await this.profileRepository.findByUsername(input.username);
    if (existing) {
      throw new AppException('USERNAME_TAKEN', `Username "${input.username}" is already taken`);
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
      throw new AppException('PROFILE_NOT_FOUND', `Profile ${id} not found`);
    }
    return profile;
  }

  // Perfil de otro usuario, con su universidad resuelta (siempre se muestra).
  async findPublicById(id: string): Promise<PublicProfile> {
    const profile = await this.findById(id);
    const university = await this.universitiesService.findById(profile.universityId);
    return toPublicProfileView(profile, university);
  }

  async findByUsername(username: string): Promise<ProfileEntity | null> {
    return this.profileRepository.findByUsername(username);
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const profile = await this.profileRepository.findByUsername(username);
    return profile === null;
  }
}
