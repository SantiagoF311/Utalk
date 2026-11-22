import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DEFAULT_JOB_OPTIONS } from '../../common/jobs.js';
import { MODERATION_QUEUE_NAME } from './contentReview.jobs.js';
import { ContentReviewService } from './contentReview.service.js';
import { CONTENT_REVIEW_QUEUE } from './domain/contentReview.queue.js';
import { BullmqContentReviewQueue } from './infrastructure/bullmq-contentReview.queue.js';

// Solo encolar la revisión por IA de un post. Va separado del módulo de
// moderación (donde está el worker) porque este lo usa PostsModule, y
// ModerationModule ya depende de PostsModule: juntos serían circulares.
@Module({
  imports: [
    BullModule.registerQueue({
      name: MODERATION_QUEUE_NAME,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }),
  ],
  providers: [
    ContentReviewService,
    { provide: CONTENT_REVIEW_QUEUE, useClass: BullmqContentReviewQueue },
  ],
  // BullModule: la cola también la usa el worker del módulo de moderación.
  exports: [ContentReviewService, BullModule],
})
export class ContentReviewModule {}
