import { Inject, Injectable, Logger } from '@nestjs/common';
import { NOTIFICATIONS_LIMIT } from '@utalk/shared';
import type { NotifyModerationResultJob } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { NOTIFICATION_QUEUE } from './domain/notification.queue.js';
import type { NotificationQueue } from './domain/notification.queue.js';
import { NOTIFICATION_REPOSITORY } from './domain/notification.repository.js';
import type {
  NotificationRepository,
  NotificationWithTarget,
} from './domain/notification.repository.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepository,
    @Inject(NOTIFICATION_QUEUE) private readonly notificationQueue: NotificationQueue,
  ) {}

  // Lo llama posts al crear un post. Nunca falla: si Redis no responde, el
  // post ya está publicado y lo único que se pierde es el aviso.
  async enqueueNewPost(postId: string): Promise<void> {
    try {
      await this.notificationQueue.enqueueNewPost(postId);
    } catch (error) {
      this.logger.error(`Could not enqueue notifications for post ${postId}`, error);
    }
  }

  // Lo llama la moderación al resolver un contenido. Igual que con los
  // posts: si la cola falla, la resolución ya quedó hecha y solo se pierde
  // el aviso.
  async enqueueModerationResult(content: NotifyModerationResultJob): Promise<void> {
    try {
      await this.notificationQueue.enqueueModerationResult(content);
    } catch (error) {
      const id = content.postId ?? content.commentId;
      this.logger.error(`Could not enqueue moderation notifications for ${id}`, error);
    }
  }

  // Los corre el worker de la cola.
  async notifySubscribers(postId: string): Promise<number> {
    return this.notificationRepository.createForNewPost(postId);
  }

  async notifyModerationResult(content: NotifyModerationResultJob): Promise<number> {
    return this.notificationRepository.createForModerationResult(content);
  }

  async findMine(userId: string): Promise<NotificationWithTarget[]> {
    return this.notificationRepository.findLatestByUser(userId, NOTIFICATIONS_LIMIT);
  }

  async countUnread(userId: string): Promise<number> {
    return this.notificationRepository.countUnread(userId);
  }

  // Idempotente. La de otro usuario da 404, igual que una que no existe.
  async markRead(id: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findById(id);
    if (!notification || !notification.belongsTo(userId)) {
      throw new AppException('NOTIFICATION_NOT_FOUND', `Notification ${id} not found`);
    }
    if (!notification.isRead()) {
      await this.notificationRepository.markRead(id);
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepository.markAllRead(userId);
  }
}
