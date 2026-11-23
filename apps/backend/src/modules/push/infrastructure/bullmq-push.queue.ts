import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { NotifyNewMessageJob, NotifyUsersJob } from '@utalk/shared';
import { Queue } from 'bullmq';
import type { PushQueue } from '../domain/push.queue.js';
import { NOTIFY_NEW_MESSAGE_JOB, NOTIFY_USERS_JOB, PUSH_QUEUE_NAME } from '../push.jobs.js';

@Injectable()
export class BullmqPushQueue implements PushQueue {
  constructor(@InjectQueue(PUSH_QUEUE_NAME) private readonly queue: Queue) {}

  async enqueueNewMessage(job: NotifyNewMessageJob): Promise<void> {
    await this.queue.add(NOTIFY_NEW_MESSAGE_JOB, job);
  }

  async enqueueUsers(job: NotifyUsersJob): Promise<void> {
    await this.queue.add(NOTIFY_USERS_JOB, job);
  }
}
