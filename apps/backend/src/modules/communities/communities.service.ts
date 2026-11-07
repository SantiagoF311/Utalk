import { Inject, Injectable } from '@nestjs/common';
import { CreateCommunityInput, UpdateCommunityInput } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { PanelsService } from '../panels/panels.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { CommunityEntity } from './domain/community.entity.js';
import { COMMUNITY_REPOSITORY } from './domain/community.repository.js';
import type { CommunityRepository } from './domain/community.repository.js';
import { COMMUNITY_MODERATOR_REPOSITORY } from './domain/communityModerator.repository.js';
import type { CommunityModeratorRepository } from './domain/communityModerator.repository.js';

@Injectable()
export class CommunitiesService {
  constructor(
    @Inject(COMMUNITY_REPOSITORY) private readonly communityRepository: CommunityRepository,
    @Inject(COMMUNITY_MODERATOR_REPOSITORY)
    private readonly communityModeratorRepository: CommunityModeratorRepository,
    private readonly panelsService: PanelsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async create(input: CreateCommunityInput, userId: string): Promise<CommunityEntity> {
    const profile = await this.profilesService.findById(userId);
    const panel = await this.panelsService.findById(input.panelId);
    if (!panel.acceptsPostsFrom(profile.universityId)) {
      throw new AppException(
        'CANNOT_PUBLISH_IN_PANEL',
        `You cannot create communities in panel ${panel.id}`,
      );
    }

    const existing = await this.communityRepository.findByPanelAndSlug(input.panelId, input.slug);
    if (existing) {
      throw new AppException(
        'COMMUNITY_SLUG_TAKEN',
        `Community slug "${input.slug}" is already taken in this panel`,
      );
    }

    // El trigger communities_add_creator_as_moderator deja al creador como primer mod.
    return this.communityRepository.create({
      panelId: input.panelId,
      slug: input.slug,
      name: input.name,
      createdBy: userId,
    });
  }

  async findByPanelId(panelId: string): Promise<CommunityEntity[]> {
    return this.communityRepository.findByPanelId(panelId);
  }

  async findById(id: string): Promise<CommunityEntity> {
    const community = await this.communityRepository.findById(id);
    if (!community) {
      throw new AppException('COMMUNITY_NOT_FOUND', `Community ${id} not found`);
    }
    return community;
  }

  async update(id: string, input: UpdateCommunityInput, userId: string): Promise<CommunityEntity> {
    await this.findModerable(id, userId);
    return this.communityRepository.update(id, { name: input.name });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findModerable(id, userId);
    await this.communityRepository.delete(id);
  }

  // Admins moderan todo; el resto, solo las comunidades donde tiene fila en
  // community_moderators.
  async canModerate(communityId: string, userId: string): Promise<boolean> {
    const profile = await this.profilesService.findById(userId);
    if (profile.isAdmin()) {
      return true;
    }
    return this.communityModeratorRepository.isModerator(communityId, userId);
  }

  private async findModerable(id: string, userId: string): Promise<CommunityEntity> {
    const community = await this.findById(id);
    if (!(await this.canModerate(community.id, userId))) {
      throw new AppException('NOT_COMMUNITY_MODERATOR', `You cannot modify community ${id}`);
    }
    return community;
  }
}
