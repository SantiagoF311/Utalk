import type { NotificationType } from '@utalk/shared';

export class NotificationEntity {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly type: NotificationType,
    readonly postId: string,
    readonly readAt: Date | null,
    readonly createdAt: Date,
  ) {}

  belongsTo(userId: string): boolean {
    return this.userId === userId;
  }

  isRead(): boolean {
    return this.readAt !== null;
  }
}
