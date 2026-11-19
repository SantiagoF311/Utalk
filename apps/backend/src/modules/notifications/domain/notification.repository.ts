import { NotificationEntity } from './notification.entity.js';

// Lo que la lista muestra de cada notificación: el post y su comunidad.
export interface NotificationWithTarget {
  notification: NotificationEntity;
  post: { id: string; title: string };
  community: { id: string; slug: string; name: string };
}

export interface NotificationRepository {
  // Una por miembro de la comunidad del post, salvo el autor y quien lo
  // bloqueó. Idempotente (un reintento no duplica). Devuelve cuántas creó.
  createForNewPost(postId: string): Promise<number>;
  findById(id: string): Promise<NotificationEntity | null>;
  // Las más nuevas primero, sin las de posts eliminados por moderación.
  findLatestByUser(userId: string, limit: number): Promise<NotificationWithTarget[]>;
  countUnread(userId: string): Promise<number>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');
