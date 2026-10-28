import { Body, Controller, Delete, HttpCode, Param, Put } from '@nestjs/common';
import { castCommentVoteSchema, castPostVoteSchema } from '@utalk/shared';
import { CurrentUserId } from '../auth/auth.guard.js';
import { VotesService } from './votes.service.js';

@Controller('votes')
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Put('posts')
  async castPostVote(@Body() body: unknown, @CurrentUserId() userId: string) {
    const input = castPostVoteSchema.parse(body);
    return this.votesService.castPostVote(input, userId);
  }

  @Delete('posts/:postId')
  @HttpCode(204)
  async removePostVote(@Param('postId') postId: string, @CurrentUserId() userId: string) {
    await this.votesService.removePostVote(postId, userId);
  }

  @Put('comments')
  async castCommentVote(@Body() body: unknown, @CurrentUserId() userId: string) {
    const input = castCommentVoteSchema.parse(body);
    return this.votesService.castCommentVote(input, userId);
  }

  @Delete('comments/:commentId')
  @HttpCode(204)
  async removeCommentVote(@Param('commentId') commentId: string, @CurrentUserId() userId: string) {
    await this.votesService.removeCommentVote(commentId, userId);
  }
}
