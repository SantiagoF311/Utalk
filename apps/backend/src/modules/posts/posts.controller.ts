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
import { createPostSchema, updatePostSchema } from '@utalk/shared';
import { CurrentUserId } from '../auth/auth.guard.js';
import { PostsService } from './posts.service.js';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUserId() userId: string) {
    const input = createPostSchema.parse(body);
    return this.postsService.create(input, userId);
  }

  @Get()
  async findByForumId(@Query('forumId', ParseUUIDPipe) forumId: string) {
    return this.postsService.findByForumId(forumId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.postsService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentUserId() userId: string) {
    const input = updatePostSchema.parse(body);
    return this.postsService.update(id, input, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string, @CurrentUserId() userId: string) {
    await this.postsService.delete(id, userId);
  }
}
