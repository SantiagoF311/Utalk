import { Module } from '@nestjs/common';
import { ForumsModule } from '../forums/forums.module.js';
import { PanelsModule } from '../panels/panels.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { POST_REPOSITORY } from './domain/post.repository.js';
import { SupabasePostRepository } from './infrastructure/supabase-post.repository.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  imports: [ForumsModule, PanelsModule, ProfilesModule],
  controllers: [PostsController],
  providers: [
    PostsService,
    { provide: POST_REPOSITORY, useClass: SupabasePostRepository },
  ],
  exports: [PostsService],
})
export class PostsModule {}
