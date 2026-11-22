import { describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { IDS } from '../../testing/fixtures.js';
import { ContentReviewService } from './contentReview.service.js';
import type { ContentReviewQueue } from './domain/contentReview.queue.js';

describe('ContentReviewService', () => {
  const queueWith = (enqueuePost: ContentReviewQueue['enqueuePost']) => ({
    enqueuePost: jest.fn(enqueuePost),
  });

  it('encola el post para que lo revise la IA', async () => {
    const queue = queueWith(() => Promise.resolve());

    await new ContentReviewService(queue).enqueuePost(IDS.post);

    expect(queue.enqueuePost).toHaveBeenCalledWith(IDS.post);
  });

  it('no falla si la cola no responde: el post ya está publicado', async () => {
    const queue = queueWith(() => Promise.reject(new Error('Redis down')));
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(new ContentReviewService(queue).enqueuePost(IDS.post)).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalled();
    logError.mockRestore();
  });
});
