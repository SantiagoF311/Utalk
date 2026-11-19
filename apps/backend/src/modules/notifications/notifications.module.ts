import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
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
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
      defaultJobOptions: {
        // El job es idempotente (unique en la tabla): reintentar es seguro.
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        // Redis no es fuente de verdad: los jobs terminados no se guardan.
        removeOnComplete: true,
        removeOnFail: 100,
      },
    }),
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
