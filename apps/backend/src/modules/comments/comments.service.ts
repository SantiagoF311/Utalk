import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommentInput, UpdateCommentInput } from '@utalk/shared';
import { PostsService } from '../posts/posts.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { CommentEntity } from './domain/comment.entity.js';
import { COMMENT_REPOSITORY } from './domain/comment.repository.js';
import type { CommentRepository } from './domain/comment.repository.js';

@Injectable()
export class CommentsService {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly commentRepository: CommentRepository,
    private readonly postsService: PostsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async create(input: CreateCommentInput, authorId: string): Promise<CommentEntity> {
    await this.profilesService.findById(authorId);
    await this.postsService.findById(input.postId);

    if (input.parentId !== null) {
      const parent = await this.findById(input.parentId);
      // La FK de parent_id no garantiza que el padre sea del mismo post.
      if (!parent.belongsToPost(input.postId)) {
        throw new BadRequestException(`Comment ${input.parentId} does not belong to post ${input.postId}`);
      }
    }

    return this.commentRepository.create({
      postId: input.postId,
      parentId: input.parentId,
      authorId,
      body: input.body,
    });
  }

  // Devuelve la lista plana ordenada por fecha; el árbol se arma a partir
  // de `parentId` del lado del cliente.
  async findByPostId(postId: string): Promise<CommentEntity[]> {
    return this.commentRepository.findByPostId(postId);
  }

  async findById(id: string): Promise<CommentEntity> {
    const comment = await this.commentRepository.findById(id);
    if (!comment) {
      throw new NotFoundException(`Comment ${id} not found`);
    }
    return comment;
  }

  async update(id: string, input: UpdateCommentInput, userId: string): Promise<CommentEntity> {
    await this.findEditable(id, userId);
    return this.commentRepository.update(id, { body: input.body });
  }

  // Borra también las respuestas (on delete cascade sobre parent_id).
  async delete(id: string, userId: string): Promise<void> {
    await this.findEditable(id, userId);
    await this.commentRepository.delete(id);
  }

  private async findEditable(id: string, userId: string): Promise<CommentEntity> {
    const comment = await this.findById(id);
    if (!comment.isEditableBy(userId)) {
      throw new ForbiddenException(`You cannot modify comment ${id}`);
    }
    return comment;
  }
}
