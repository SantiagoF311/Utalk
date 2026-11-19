import type { NotifyModerationResultJob } from '@utalk/shared';
import { NotificationEntity } from './notification.entity.js';

// Lo que la lista muestra de cada notificación: el post y su comunidad, y
// en un aviso de reporte, el caso y en qué quedó.
export interface NotificationWithTarget {
  notification: NotificationEntity;
  post: { id: string; title: string };
  community: { id: string; slug: string; name: string };
  report: { caseNumber: number; status: 'removed' | 'dismissed' } | null;
}

export interface NotificationRepository {
  // Una por miembro de la comunidad del post, salvo el autor y quien lo
  // bloqueó. Idempotente (un reintento no duplica). Devuelve cuántas creó.
  createForNewPost(postId: string): Promise<number>;
  // Avisos de una resolución de moderación: a cada uno que reportó ese
  // contenido y, si se eliminó, a su autor. Idempotente. Devuelve cuántas creó.
  createForModerationResult(content: NotifyModerationResultJob): Promise<number>;
  findById(id: string): Promise<NotificationEntity | null>;
  // Las más nuevas primero. Las de un post nuevo que después se eliminó no
  // aparecen; las de moderación, sí.
  findLatestByUser(userId: string, limit: number): Promise<NotificationWithTarget[]>;
  countUnread(userId: string): Promise<number>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');
