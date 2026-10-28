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
import { createCommentSchema, updateCommentSchema } from '@utalk/shared';
import { CurrentUserId } from '../auth/auth.guard.js';
import { CommentsService } from './comments.service.js';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUserId() userId: string) {
    const input = createCommentSchema.parse(body);
    return this.commentsService.create(input, userId);
  }

  @Get()
  async findByPostId(@Query('postId', ParseUUIDPipe) postId: string) {
    return this.commentsService.findByPostId(postId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.commentsService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentUserId() userId: string) {
    const input = updateCommentSchema.parse(body);
    return this.commentsService.update(id, input, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string, @CurrentUserId() userId: string) {
    await this.commentsService.delete(id, userId);
  }
}
