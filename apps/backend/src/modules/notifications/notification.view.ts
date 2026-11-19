import type { NotificationView } from '@utalk/shared';
import type { NotificationWithTarget } from './domain/notification.repository.js';

export function toNotificationView({
  notification,
  post,
  community,
  report,
}: NotificationWithTarget): NotificationView {
  const base = {
    id: notification.id,
    post,
    community,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };

  switch (notification.type) {
    case 'new_post_in_community':
      return { ...base, type: notification.type };
    case 'report_resolved':
      // La base no deja un aviso de reporte sin su reporte (check
      // notifications_report_only_when_resolved, y on delete cascade).
      if (!report) {
        throw new Error(`Notification ${notification.id} is report_resolved without a report`);
      }
      return {
        ...base,
        type: notification.type,
        target: notification.target(),
        report: { caseNumber: report.caseNumber, outcome: report.status },
      };
    case 'content_removed':
      return { ...base, type: notification.type, target: notification.target() };
  }
}
