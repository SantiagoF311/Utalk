import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { List, NotificationView, UnreadNotificationCount } from '@utalk/shared';
import { CurrentUserId } from '../auth/auth.guard.js';
import { toNotificationView } from './notification.view.js';
import { NotificationsService } from './notifications.service.js';

// Solo se leen y se marcan como leídas: las crea el worker de la cola.
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findMine(@CurrentUserId() userId: string): Promise<List<NotificationView>> {
    const notifications = await this.notificationsService.findMine(userId);
    return { items: notifications.map(toNotificationView) };
  }

  @Get('unread-count')
  async countUnread(@CurrentUserId() userId: string): Promise<UnreadNotificationCount> {
    return { count: await this.notificationsService.countUnread(userId) };
  }

  // Antes que `:id/read`, para que "read-all" no se tome como un id.
  @Post('read-all')
  @HttpCode(204)
  async markAllRead(@CurrentUserId() userId: string): Promise<void> {
    await this.notificationsService.markAllRead(userId);
  }

  @Post(':id/read')
  @HttpCode(204)
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    await this.notificationsService.markRead(id, userId);
  }
}
