import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';
import { COMMENT_REPOSITORY } from './domain/comment.repository.js';
import { SupabaseCommentRepository } from './infrastructure/supabase-comment.repository.js';

@Module({
  imports: [PostsModule, ProfilesModule],
  controllers: [CommentsController],
  providers: [
    CommentsService,
    { provide: COMMENT_REPOSITORY, useClass: SupabaseCommentRepository },
  ],
  exports: [CommentsService],
})
export class CommentsModule {}
