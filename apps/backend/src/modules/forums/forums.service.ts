import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateForumInput, UpdateForumInput } from '@utalk/shared';
import { PanelsService } from '../panels/panels.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { ForumEntity } from './domain/forum.entity.js';
import { FORUM_REPOSITORY } from './domain/forum.repository.js';
import type { ForumRepository } from './domain/forum.repository.js';

@Injectable()
export class ForumsService {
  constructor(
    @Inject(FORUM_REPOSITORY) private readonly forumRepository: ForumRepository,
    private readonly panelsService: PanelsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async create(input: CreateForumInput, userId: string): Promise<ForumEntity> {
    await this.profilesService.findById(userId);
    await this.panelsService.findById(input.panelId);

    const existing = await this.forumRepository.findByPanelAndSlug(input.panelId, input.slug);
    if (existing) {
      throw new ConflictException(`Forum slug "${input.slug}" is already taken in this panel`);
    }

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
      throw new NotFoundException(`Forum ${id} not found`);
    }
    return forum;
  }

  async update(id: string, input: UpdateForumInput, userId: string): Promise<ForumEntity> {
    await this.findEditable(id, userId);
    return this.forumRepository.update(id, { name: input.name });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findEditable(id, userId);
    await this.forumRepository.delete(id);
  }

  private async findEditable(id: string, userId: string): Promise<ForumEntity> {
    const forum = await this.findById(id);
    if (!forum.isEditableBy(userId)) {
      throw new ForbiddenException(`You cannot modify forum ${id}`);
    }
    return forum;
  }
}
