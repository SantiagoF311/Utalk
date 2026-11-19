// Puerto de la cola: el service encola sin saber que abajo hay BullMQ.
export interface NotificationQueue {
  enqueueNewPost(postId: string): Promise<void>;
}

export const NOTIFICATION_QUEUE = Symbol('NOTIFICATION_QUEUE');
