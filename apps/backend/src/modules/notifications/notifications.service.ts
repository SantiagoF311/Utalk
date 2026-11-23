import { Inject, Injectable, Logger } from '@nestjs/common';
import { NOTIFICATIONS_LIMIT } from '@utalk/shared';
import type { NotifyModerationResultJob } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { PushService } from '../push/push.service.js';
import { toNotificationPush } from './notification.view.js';
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
    private readonly pushService: PushService,
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

  // Los corre el worker de la cola. Cada notificación creada también va por
  // push; un reintento no crea ninguna, así que tampoco repite el push.
  async notifySubscribers(postId: string): Promise<number> {
    const ids = await this.notificationRepository.createForNewPost(postId);
    await this.push(ids);
    return ids.length;
  }

  async notifyModerationResult(content: NotifyModerationResultJob): Promise<number> {
    const ids = await this.notificationRepository.createForModerationResult(content);
    await this.push(ids);
    return ids.length;
  }

  // Manda por push notificaciones ya creadas (las de arriba, y la de un post
  // retenido por la IA, que crea la moderación). Nunca falla: la
  // notificación ya está guardada y se ve en la campana; si algo falla acá,
  // solo se pierde el push (reintentar no serviría: ya no habría ids nuevos).
  async push(notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;
    try {
      const notifications = await this.notificationRepository.findManyWithTarget(notificationIds);
      await this.pushService.enqueueToUsers(notifications.map(toNotificationPush));
    } catch (error) {
      this.logger.error(`Could not push ${notificationIds.length} notifications`, error);
    }
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

  // Eliminarla de la lista (no toca el post ni el reporte). La de otro
  // usuario da 404, igual que una que no existe (o que ya se eliminó).
  async remove(id: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findById(id);
    if (!notification || !notification.belongsTo(userId)) {
      throw new AppException('NOTIFICATION_NOT_FOUND', `Notification ${id} not found`);
    }
    await this.notificationRepository.delete(id);
  }

  async removeAll(userId: string): Promise<void> {
    await this.notificationRepository.deleteAllByUser(userId);
  }
}
