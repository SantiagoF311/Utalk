import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { castCommentVoteSchema, castPostVoteSchema } from '@utalk/shared';
import type { CommentVote, PostVote } from '@utalk/shared';
import { CurrentUserId } from '../auth/auth.guard.js';
import { toCommentVoteView, toPostVoteView } from './vote.view.js';
import { VotesService } from './votes.service.js';

@Controller('votes')
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Put('posts')
  async castPostVote(@Body() body: unknown, @CurrentUserId() userId: string): Promise<PostVote> {
    const input = castPostVoteSchema.parse(body);
    return toPostVoteView(await this.votesService.castPostVote(input, userId));
  }

  @Delete('posts/:postId')
  @HttpCode(204)
  async removePostVote(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUserId() userId: string,
  ) {
    await this.votesService.removePostVote(postId, userId);
  }

  @Put('comments')
  async castCommentVote(
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<CommentVote> {
    const input = castCommentVoteSchema.parse(body);
    return toCommentVoteView(await this.votesService.castCommentVote(input, userId));
  }

  @Delete('comments/:commentId')
  @HttpCode(204)
  async removeCommentVote(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUserId() userId: string,
  ) {
    await this.votesService.removeCommentVote(commentId, userId);
  }
}
