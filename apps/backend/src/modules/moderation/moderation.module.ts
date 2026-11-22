import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommentsModule } from '../comments/comments.module.js';
import { CommunitiesModule } from '../communities/communities.module.js';
import { ContentReviewModule } from '../contentReview/contentReview.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { ContentReviewProcessor } from './contentReview.processor.js';
import { CONTENT_CLASSIFIER } from './domain/contentClassifier.js';
import type { ContentClassifier } from './domain/contentClassifier.js';
import { MODERATION_REPOSITORY } from './domain/moderation.repository.js';
import {
  DisabledContentClassifier,
  OpenAiContentClassifier,
} from './infrastructure/openai-content.classifier.js';
import { SupabaseModerationRepository } from './infrastructure/supabase-moderation.repository.js';
import { ModerationController } from './moderation.controller.js';
import { ModerationService } from './moderation.service.js';

@Module({
  imports: [
    CommunitiesModule,
    PostsModule,
    CommentsModule,
    ProfilesModule,
    NotificationsModule,
    // La cola `moderation`, para el worker que revisa los posts nuevos.
    ContentReviewModule,
  ],
  controllers: [ModerationController],
  providers: [
    ModerationService,
    ContentReviewProcessor,
    { provide: MODERATION_REPOSITORY, useClass: SupabaseModerationRepository },
    {
      // Sin OPENAI_API_KEY, apagada (como Sentry sin DSN).
      provide: CONTENT_CLASSIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ContentClassifier => {
        const apiKey = config.get<string>('OPENAI_API_KEY');
        return apiKey ? new OpenAiContentClassifier(apiKey) : new DisabledContentClassifier();
      },
    },
  ],
})
export class ModerationModule {}
