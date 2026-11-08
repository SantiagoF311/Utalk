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
import { authorCommentsQuerySchema, createCommentSchema, updateCommentSchema } from '@utalk/shared';
import type { CommentView, List, ProfileCommentPage } from '@utalk/shared';
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

  // Comentarios de un autor para su perfil, del más nuevo al más viejo
  // (PROFILE_PRIVATE si es privado y no es el propio).
  @Get('by-author/:authorId')
  async findByAuthor(
    @Param('authorId', ParseUUIDPipe) authorId: string,
    @Query() rawQuery: unknown,
    @CurrentUserId() userId: string,
  ): Promise<ProfileCommentPage> {
    const query = authorCommentsQuerySchema.parse(rawQuery);
    return this.commentsService.findPageByAuthor(authorId, query, userId);
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
