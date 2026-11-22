// Puerto de la cola: los posts encolan la revisión sin saber que abajo hay BullMQ.
export interface ContentReviewQueue {
  enqueuePost(postId: string): Promise<void>;
}

export const CONTENT_REVIEW_QUEUE = Symbol('CONTENT_REVIEW_QUEUE');
