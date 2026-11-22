import { Module } from '@nestjs/common';
import { CommunitiesModule } from '../communities/communities.module.js';
import { ContentReviewModule } from '../contentReview/contentReview.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PanelsModule } from '../panels/panels.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { POST_REPOSITORY } from './domain/post.repository.js';
import { POST_IMAGE_STORAGE } from './domain/postImage.storage.js';
import { SupabasePostRepository } from './infrastructure/supabase-post.repository.js';
import { SupabasePostImageStorage } from './infrastructure/supabase-postImage.storage.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  imports: [
    CommunitiesModule,
    PanelsModule,
    ProfilesModule,
    NotificationsModule,
    ContentReviewModule,
  ],
  controllers: [PostsController],
  providers: [
    PostsService,
    { provide: POST_REPOSITORY, useClass: SupabasePostRepository },
    { provide: POST_IMAGE_STORAGE, useClass: SupabasePostImageStorage },
  ],
  exports: [PostsService],
})
export class PostsModule {}
