import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module.js';
import { CommunitiesModule } from '../communities/communities.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { MODERATION_REPOSITORY } from './domain/moderation.repository.js';
import { SupabaseModerationRepository } from './infrastructure/supabase-moderation.repository.js';
import { ModerationController } from './moderation.controller.js';
import { ModerationService } from './moderation.service.js';

@Module({
  imports: [CommunitiesModule, PostsModule, CommentsModule, ProfilesModule],
  controllers: [ModerationController],
  providers: [
    ModerationService,
    { provide: MODERATION_REPOSITORY, useClass: SupabaseModerationRepository },
  ],
})
export class ModerationModule {}
