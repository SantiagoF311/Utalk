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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  createPostSchema,
  POST_IMAGE_FIELD,
  POST_IMAGE_MAX_BYTES,
  postFeedQuerySchema,
  updatePostSchema,
} from '@utalk/shared';
import { STRICT_RATE_LIMITS } from '../../common/rateLimits.js';
import { CurrentUserId } from '../auth/auth.guard.js';
import { PostsService } from './posts.service.js';

// Lo que deja multer del archivo (en memoria: nunca se escribe a disco).
interface UploadedImage {
  buffer: Buffer;
}

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // JSON (sin imagen) o multipart con los mismos campos más `image`. Más de
  // 5 MB corta la subida con 413 PAYLOAD_TOO_LARGE antes de leer el resto.
  @Throttle(STRICT_RATE_LIMITS.createPost)
  @Post()
  @UseInterceptors(
    FileInterceptor(POST_IMAGE_FIELD, { limits: { fileSize: POST_IMAGE_MAX_BYTES, files: 1 } }),
  )
  async create(
    @Body() body: unknown,
    @UploadedFile() file: UploadedImage | undefined,
    @CurrentUserId() userId: string,
  ) {
    const input = createPostSchema.parse(body);
    return this.postsService.create(input, userId, file ? { content: file.buffer } : null);
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
