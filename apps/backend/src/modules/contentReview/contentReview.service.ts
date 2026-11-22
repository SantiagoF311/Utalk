import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONTENT_REVIEW_QUEUE } from './domain/contentReview.queue.js';
import type { ContentReviewQueue } from './domain/contentReview.queue.js';

@Injectable()
export class ContentReviewService {
  private readonly logger = new Logger(ContentReviewService.name);

  constructor(@Inject(CONTENT_REVIEW_QUEUE) private readonly queue: ContentReviewQueue) {}

  // Lo llama posts al publicar. Nunca falla: el post ya está publicado
  // (publicación optimista) y, si la cola no responde, solo se pierde la
  // revisión automática; los reportes de las personas siguen funcionando.
  async enqueuePost(postId: string): Promise<void> {
    try {
      await this.queue.enqueuePost(postId);
    } catch (error) {
      this.logger.error(`Could not enqueue AI review for post ${postId}`, error);
    }
  }
}
