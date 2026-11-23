import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DEFAULT_JOB_OPTIONS } from '../../common/jobs.js';
import { PushModule } from '../push/push.module.js';
import { NOTIFICATION_QUEUE } from './domain/notification.queue.js';
import { NOTIFICATION_REPOSITORY } from './domain/notification.repository.js';
import { BullmqNotificationQueue } from './infrastructure/bullmq-notification.queue.js';
import { SupabaseNotificationRepository } from './infrastructure/supabase-notification.repository.js';
import { NOTIFICATIONS_QUEUE } from './notifications.jobs.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsProcessor } from './notifications.processor.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [
    // Los jobs son idempotentes (unique en la tabla): reintentar es seguro.
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    // Cada notificación también va por push.
    PushModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    { provide: NOTIFICATION_REPOSITORY, useClass: SupabaseNotificationRepository },
    { provide: NOTIFICATION_QUEUE, useClass: BullmqNotificationQueue },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
