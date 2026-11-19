import type { NotificationView } from '@utalk/shared';
import type { NotificationWithTarget } from './domain/notification.repository.js';

export function toNotificationView({
  notification,
  post,
  community,
}: NotificationWithTarget): NotificationView {
  return {
    id: notification.id,
    type: notification.type,
    post,
    community,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}
