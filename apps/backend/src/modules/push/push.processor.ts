import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import * as Sentry from '@sentry/nestjs';
import { notifyNewMessageJobSchema } from '@utalk/shared';
import type { NotifyNewMessageJob } from '@utalk/shared';
import type { Job } from 'bullmq';
import { isFinalAttempt } from '../../common/jobs.js';
import { NOTIFY_NEW_MESSAGE_JOB, PUSH_QUEUE_NAME } from './push.jobs.js';
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
      default:
        throw new Error(`Unknown job "${job.name}" in queue ${PUSH_QUEUE_NAME}`);
    }
  }

  // El payload lleva el comienzo del mensaje: a Sentry van solo los ids. Se
  // leen sin validar: el job pudo fallar justamente por datos inválidos.
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    if (!job || !isFinalAttempt(job)) return;
    const { conversationId, recipientId } = job.data as Partial<NotifyNewMessageJob>;
    Sentry.captureException(error, {
      tags: { queue: PUSH_QUEUE_NAME, job: job.name },
      extra: { jobId: job.id, conversationId, recipientId },
    });
  }
}
