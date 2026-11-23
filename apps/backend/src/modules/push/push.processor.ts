import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import * as Sentry from '@sentry/nestjs';
import { notifyNewMessageJobSchema, notifyUsersJobSchema } from '@utalk/shared';
import type { NotifyNewMessageJob, NotifyUsersJob } from '@utalk/shared';
import type { Job } from 'bullmq';
import { isFinalAttempt } from '../../common/jobs.js';
import { NOTIFY_NEW_MESSAGE_JOB, NOTIFY_USERS_JOB, PUSH_QUEUE_NAME } from './push.jobs.js';
import { PushService } from './push.service.js';

// Worker de la cola `push`: corre en el mismo proceso que la API.
@Processor(PUSH_QUEUE_NAME)
export class PushProcessor extends WorkerHost {
  constructor(private readonly pushService: PushService) {
    super();
  }

  async process(job: Job): Promise<number> {
    switch (job.name) {
      case NOTIFY_NEW_MESSAGE_JOB:
        return this.pushService.deliverNewMessage(notifyNewMessageJobSchema.parse(job.data));
      case NOTIFY_USERS_JOB:
        return this.pushService.deliverToUsers(notifyUsersJobSchema.parse(job.data));
      default:
        throw new Error(`Unknown job "${job.name}" in queue ${PUSH_QUEUE_NAME}`);
    }
  }

  // El payload lleva texto (el comienzo del mensaje, el título del post): a
  // Sentry van solo los ids. Se leen sin validar: el job pudo fallar
  // justamente por datos inválidos.
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    if (!job || !isFinalAttempt(job)) return;
    Sentry.captureException(error, {
      tags: { queue: PUSH_QUEUE_NAME, job: job.name },
      extra: { jobId: job.id, ...safeIds(job) },
    });
  }
}

function safeIds(job: Job): Record<string, unknown> {
  if (job.name === NOTIFY_USERS_JOB) {
    const { messages } = job.data as Partial<NotifyUsersJob>;
    return { recipientIds: messages?.map((message) => message.recipientId) };
  }
  const { conversationId, recipientId } = job.data as Partial<NotifyNewMessageJob>;
  return { conversationId, recipientId };
}
