import type { NotificationType } from '@utalk/shared';

export class NotificationEntity {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly type: NotificationType,
    // En un comentario, el post donde está.
    readonly postId: string,
    // null = es sobre el post (o es un aviso de post nuevo).
    readonly commentId: string | null,
    readonly readAt: Date | null,
    readonly createdAt: Date,
  ) {}

  belongsTo(userId: string): boolean {
    return this.userId === userId;
  }

  isRead(): boolean {
    return this.readAt !== null;
  }

  // Sobre qué es un aviso de moderación: la publicación o un comentario.
  target(): 'post' | 'comment' {
    return this.commentId === null ? 'post' : 'comment';
  }
}
