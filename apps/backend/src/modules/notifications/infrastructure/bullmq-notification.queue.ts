import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { NotifySubscribersJob } from '@utalk/shared';
import { Queue } from 'bullmq';
import type { NotificationQueue } from '../domain/notification.queue.js';
import { NOTIFICATIONS_QUEUE, NOTIFY_SUBSCRIBERS_JOB } from '../notifications.jobs.js';

@Injectable()
export class BullmqNotificationQueue implements NotificationQueue {
  constructor(@InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue) {}

  async enqueueNewPost(postId: string): Promise<void> {
    const payload: NotifySubscribersJob = { postId };
    // jobId fijo por post: si se encola dos veces mientras el primero sigue
    // en la cola, BullMQ lo ignora.
    await this.queue.add(NOTIFY_SUBSCRIBERS_JOB, payload, {
      jobId: `${NOTIFY_SUBSCRIBERS_JOB}-${postId}`,
    });
  }
}
