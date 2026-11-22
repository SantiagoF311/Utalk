import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import * as Sentry from '@sentry/nestjs';
import { moderateContentJobSchema } from '@utalk/shared';
import type { Job } from 'bullmq';
import { isFinalAttempt } from '../../common/jobs.js';
import {
  MODERATE_CONTENT_JOB,
  MODERATION_QUEUE_NAME,
  MODERATION_RATE_LIMIT,
} from '../contentReview/contentReview.jobs.js';
import { ModerationService } from './moderation.service.js';

// Worker de la cola `moderation`: corre en el mismo proceso que la API. El
// limiter hace que las revisiones esperen en la cola en vez de pasarse del
// límite del proveedor de IA.
@Processor(MODERATION_QUEUE_NAME, { limiter: MODERATION_RATE_LIMIT })
export class ContentReviewProcessor extends WorkerHost {
  constructor(private readonly moderationService: ModerationService) {
    super();
  }

  async process(job: Job): Promise<boolean> {
    switch (job.name) {
      case MODERATE_CONTENT_JOB: {
        const { postId } = moderateContentJobSchema.parse(job.data);
        return this.moderationService.reviewPost(postId);
      }
      default:
        throw new Error(`Unknown job "${job.name}" in queue ${MODERATION_QUEUE_NAME}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    if (!job || !isFinalAttempt(job)) return;
    Sentry.captureException(error, {
      tags: { queue: MODERATION_QUEUE_NAME, job: job.name },
      extra: { jobId: job.id, data: job.data as unknown },
    });
  }
}
