import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePostInput, UpdatePostInput } from '@utalk/shared';
import { ForumsService } from '../forums/forums.service.js';
import { PanelsService } from '../panels/panels.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { PostEntity } from './domain/post.entity.js';
import { POST_REPOSITORY } from './domain/post.repository.js';
import type { PostRepository } from './domain/post.repository.js';

@Injectable()
export class PostsService {
  constructor(
    @Inject(POST_REPOSITORY) private readonly postRepository: PostRepository,
    private readonly forumsService: ForumsService,
    private readonly panelsService: PanelsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async create(input: CreatePostInput, authorId: string): Promise<PostEntity> {
    const author = await this.profilesService.findById(authorId);
    const forum = await this.forumsService.findById(input.forumId);
    const panel = await this.panelsService.findById(forum.panelId);
    if (!panel.acceptsPostsFrom(author.universityId)) {
      throw new ForbiddenException(`You cannot post in forum ${forum.id}`);
    }

    return this.postRepository.create({
      forumId: input.forumId,
      authorId,
      title: input.title,
      body: input.body,
    });
  }

  async findByForumId(forumId: string): Promise<PostEntity[]> {
    return this.postRepository.findByForumId(forumId);
  }

  async findById(id: string): Promise<PostEntity> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post ${id} not found`);
    }
    return post;
  }

  async update(id: string, input: UpdatePostInput, userId: string): Promise<PostEntity> {
    await this.findEditable(id, userId);
    return this.postRepository.update(id, { title: input.title, body: input.body });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findEditable(id, userId);
    await this.postRepository.delete(id);
  }

  private async findEditable(id: string, userId: string): Promise<PostEntity> {
    const post = await this.findById(id);
    if (!post.isEditableBy(userId)) {
      throw new ForbiddenException(`You cannot modify post ${id}`);
    }
    return post;
  }
}
