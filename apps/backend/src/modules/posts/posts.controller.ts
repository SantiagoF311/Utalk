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
import { createPostSchema, postFeedQuerySchema, updatePostSchema } from '@utalk/shared';
import { STRICT_RATE_LIMITS } from '../../common/rateLimits.js';
import { CurrentUserId } from '../auth/auth.guard.js';
import { PostsService } from './posts.service.js';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Throttle(STRICT_RATE_LIMITS.createPost)
  @Post()
  async create(@Body() body: unknown, @CurrentUserId() userId: string) {
    const input = createPostSchema.parse(body);
    return this.postsService.create(input, userId);
  }

  // GET /posts?communityId=…|panelId=…&sort=hot|new|top&cursor=…&limit=…
  @Get()
  async findFeed(@Query() rawQuery: unknown, @CurrentUserId() userId: string) {
    const query = postFeedQuerySchema.parse(rawQuery);
    return this.postsService.findFeed(query, userId);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string, @CurrentUserId() userId: string) {
    return this.postsService.findViewById(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ) {
    const input = updatePostSchema.parse(body);
    return this.postsService.update(id, input, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUserId() userId: string) {
    await this.postsService.delete(id, userId);
  }
}
