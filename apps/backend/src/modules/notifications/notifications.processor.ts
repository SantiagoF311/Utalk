import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import * as Sentry from '@sentry/nestjs';
import { notifyModerationResultJobSchema, notifySubscribersJobSchema } from '@utalk/shared';
import type { Job } from 'bullmq';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFY_MODERATION_RESULT_JOB,
  NOTIFY_SUBSCRIBERS_JOB,
} from './notifications.jobs.js';
import { NotificationsService } from './notifications.service.js';

// Un intento fallido que BullMQ todavía va a reintentar no es un problema;
// el último, sí: ese aviso no se va a mandar.
export function isFinalAttempt(job: Pick<Job, 'attemptsMade' | 'opts'>): boolean {
  return job.attemptsMade >= (job.opts.attempts ?? 1);
}

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
      case NOTIFY_MODERATION_RESULT_JOB:
        return this.notificationsService.notifyModerationResult(
          notifyModerationResultJobSchema.parse(job.data),
        );
      default:
        throw new Error(`Unknown job "${job.name}" in queue ${NOTIFICATIONS_QUEUE}`);
    }
  }

  // Los errores de un job no pasan por el filtro HTTP: se reportan acá. El
  // payload son solo ids, sin datos personales.
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    if (!job || !isFinalAttempt(job)) return;
    Sentry.captureException(error, {
      tags: { queue: NOTIFICATIONS_QUEUE, job: job.name },
      extra: { jobId: job.id, data: job.data as unknown },
    });
  }
}
