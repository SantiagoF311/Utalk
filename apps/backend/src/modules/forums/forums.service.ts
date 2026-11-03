import { Inject, Injectable } from '@nestjs/common';
import { CreateForumInput, UpdateForumInput } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { PanelsService } from '../panels/panels.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { ForumEntity } from './domain/forum.entity.js';
import { FORUM_REPOSITORY } from './domain/forum.repository.js';
import type { ForumRepository } from './domain/forum.repository.js';
import { FORUM_MODERATOR_REPOSITORY } from './domain/forumModerator.repository.js';
import type { ForumModeratorRepository } from './domain/forumModerator.repository.js';

@Injectable()
export class ForumsService {
  constructor(
    @Inject(FORUM_REPOSITORY) private readonly forumRepository: ForumRepository,
    @Inject(FORUM_MODERATOR_REPOSITORY)
    private readonly forumModeratorRepository: ForumModeratorRepository,
    private readonly panelsService: PanelsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async create(input: CreateForumInput, userId: string): Promise<ForumEntity> {
    const profile = await this.profilesService.findById(userId);
    const panel = await this.panelsService.findById(input.panelId);
    if (!panel.acceptsPostsFrom(profile.universityId)) {
      throw new AppException(
        'CANNOT_PUBLISH_IN_PANEL',
        `You cannot create forums in panel ${panel.id}`,
      );
    }

    const existing = await this.forumRepository.findByPanelAndSlug(input.panelId, input.slug);
    if (existing) {
      throw new AppException(
        'FORUM_SLUG_TAKEN',
        `Forum slug "${input.slug}" is already taken in this panel`,
      );
    }

    // El trigger forums_add_creator_as_moderator deja al creador como primer mod.
    return this.forumRepository.create({
      panelId: input.panelId,
      slug: input.slug,
      name: input.name,
      createdBy: userId,
    });
  }

  async findByPanelId(panelId: string): Promise<ForumEntity[]> {
    return this.forumRepository.findByPanelId(panelId);
  }

  async findById(id: string): Promise<ForumEntity> {
    const forum = await this.forumRepository.findById(id);
    if (!forum) {
      throw new AppException('FORUM_NOT_FOUND', `Forum ${id} not found`);
    }
    return forum;
  }

  async update(id: string, input: UpdateForumInput, userId: string): Promise<ForumEntity> {
    await this.findModerable(id, userId);
    return this.forumRepository.update(id, { name: input.name });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findModerable(id, userId);
    await this.forumRepository.delete(id);
  }

  // Admins moderan todo; el resto, solo los foros donde tiene fila en
  // forum_moderators.
  async canModerate(forumId: string, userId: string): Promise<boolean> {
    const profile = await this.profilesService.findById(userId);
    if (profile.isAdmin()) {
      return true;
    }
    return this.forumModeratorRepository.isModerator(forumId, userId);
  }

  private async findModerable(id: string, userId: string): Promise<ForumEntity> {
    const forum = await this.findById(id);
    if (!(await this.canModerate(forum.id, userId))) {
      throw new AppException('NOT_FORUM_MODERATOR', `You cannot modify forum ${id}`);
    }
    return forum;
  }
}
