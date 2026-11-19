import type { NotifyNewMessageJob } from '@utalk/shared';

// Puerto de la cola: el chat encola el aviso sin saber que abajo hay BullMQ.
export interface PushQueue {
  enqueueNewMessage(job: NotifyNewMessageJob): Promise<void>;
}

export const PUSH_QUEUE = Symbol('PUSH_QUEUE');
