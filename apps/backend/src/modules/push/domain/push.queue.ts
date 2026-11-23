import type { NotifyNewMessageJob, NotifyUsersJob } from '@utalk/shared';

// Puerto de la cola: el chat y las notificaciones encolan el aviso sin saber
// que abajo hay BullMQ.
export interface PushQueue {
  enqueueNewMessage(job: NotifyNewMessageJob): Promise<void>;
  enqueueUsers(job: NotifyUsersJob): Promise<void>;
}

export const PUSH_QUEUE = Symbol('PUSH_QUEUE');
