import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { ModerateContentJob } from '@utalk/shared';
import { Queue } from 'bullmq';
import { MODERATE_CONTENT_JOB, MODERATION_QUEUE_NAME } from '../contentReview.jobs.js';
import type { ContentReviewQueue } from '../domain/contentReview.queue.js';

@Injectable()
export class BullmqContentReviewQueue implements ContentReviewQueue {
  constructor(@InjectQueue(MODERATION_QUEUE_NAME) private readonly queue: Queue) {}

  async enqueuePost(postId: string): Promise<void> {
    const payload: ModerateContentJob = { postId };
    // jobId fijo por post: si se encola dos veces mientras espera, BullMQ lo ignora.
    await this.queue.add(MODERATE_CONTENT_JOB, payload, {
      jobId: `${MODERATE_CONTENT_JOB}-${postId}`,
    });
  }
}
