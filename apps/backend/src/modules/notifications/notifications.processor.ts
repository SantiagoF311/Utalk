import { Processor, WorkerHost } from '@nestjs/bullmq';
import { notifySubscribersJobSchema } from '@utalk/shared';
import type { Job } from 'bullmq';
import { NOTIFICATIONS_QUEUE, NOTIFY_SUBSCRIBERS_JOB } from './notifications.jobs.js';
import { NotificationsService } from './notifications.service.js';

// Worker de la cola `notifications`: corre en el mismo proceso que la API.
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job): Promise<number> {
    switch (job.name) {
      case NOTIFY_SUBSCRIBERS_JOB: {
        const { postId } = notifySubscribersJobSchema.parse(job.data);
        return this.notificationsService.notifySubscribers(postId);
      }
      default:
        throw new Error(`Unknown job "${job.name}" in queue ${NOTIFICATIONS_QUEUE}`);
    }
  }
}
