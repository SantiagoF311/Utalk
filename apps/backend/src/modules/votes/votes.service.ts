import { Inject, Injectable } from '@nestjs/common';
import { CastCommentVoteInput, CastPostVoteInput } from '@utalk/shared';
import { CommentsService } from '../comments/comments.service.js';
import { PostsService } from '../posts/posts.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { CommentVoteEntity } from './domain/commentVote.entity.js';
import { COMMENT_VOTE_REPOSITORY } from './domain/commentVote.repository.js';
import type { CommentVoteRepository } from './domain/commentVote.repository.js';
import { PostVoteEntity } from './domain/postVote.entity.js';
import { POST_VOTE_REPOSITORY } from './domain/postVote.repository.js';
import type { PostVoteRepository } from './domain/postVote.repository.js';

@Injectable()
export class VotesService {
  constructor(
    @Inject(POST_VOTE_REPOSITORY) private readonly postVoteRepository: PostVoteRepository,
    @Inject(COMMENT_VOTE_REPOSITORY) private readonly commentVoteRepository: CommentVoteRepository,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async castPostVote(input: CastPostVoteInput, userId: string): Promise<PostVoteEntity> {
    await this.profilesService.findById(userId);
    await this.postsService.findById(input.postId);

    return this.postVoteRepository.upsert({
      postId: input.postId,
      userId,
      value: input.value,
    });
  }

  async removePostVote(postId: string, userId: string): Promise<void> {
    await this.postVoteRepository.delete(postId, userId);
  }

  async castCommentVote(input: CastCommentVoteInput, userId: string): Promise<CommentVoteEntity> {
    await this.profilesService.findById(userId);
    await this.commentsService.findById(input.commentId);

    return this.commentVoteRepository.upsert({
      commentId: input.commentId,
      userId,
      value: input.value,
    });
  }

  async removeCommentVote(commentId: string, userId: string): Promise<void> {
    await this.commentVoteRepository.delete(commentId, userId);
  }
}
