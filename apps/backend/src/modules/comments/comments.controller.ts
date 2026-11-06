import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createCommentSchema, updateCommentSchema } from '@utalk/shared';
import type { CommentView, List } from '@utalk/shared';
import { STRICT_RATE_LIMITS } from '../../common/rateLimits.js';
import { CurrentUserId } from '../auth/auth.guard.js';
import { CommentsService } from './comments.service.js';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Throttle(STRICT_RATE_LIMITS.createComment)
  @Post()
  async create(@Body() body: unknown, @CurrentUserId() userId: string) {
    const input = createCommentSchema.parse(body);
    return this.commentsService.create(input, userId);
  }

  // Árbol completo de comentarios del post, con respuestas anidadas.
  @Get()
  async findTreeByPostId(
    @Query('postId', ParseUUIDPipe) postId: string,
    @CurrentUserId() userId: string,
  ): Promise<List<CommentView>> {
    return { items: await this.commentsService.findTreeByPostId(postId, userId) };
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string, @CurrentUserId() userId: string) {
    return this.commentsService.findViewById(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ) {
    const input = updateCommentSchema.parse(body);
    return this.commentsService.update(id, input, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUserId() userId: string) {
    await this.commentsService.delete(id, userId);
  }
}
