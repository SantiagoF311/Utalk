import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DEFAULT_JOB_OPTIONS } from '../../common/jobs.js';
import { PUSH_QUEUE } from './domain/push.queue.js';
import { PUSH_SENDER } from './domain/push.sender.js';
import { PUSH_TOKEN_REPOSITORY } from './domain/pushToken.repository.js';
import { BullmqPushQueue } from './infrastructure/bullmq-push.queue.js';
import { ExpoPushSender } from './infrastructure/expo-push.sender.js';
import { SupabasePushTokenRepository } from './infrastructure/supabase-pushToken.repository.js';
import { PushController } from './push.controller.js';
import { PUSH_QUEUE_NAME } from './push.jobs.js';
import { PushProcessor } from './push.processor.js';
import { PushService } from './push.service.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: PUSH_QUEUE_NAME, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
  ],
  controllers: [PushController],
  providers: [
    PushService,
    PushProcessor,
    { provide: PUSH_TOKEN_REPOSITORY, useClass: SupabasePushTokenRepository },
    { provide: PUSH_SENDER, useClass: ExpoPushSender },
    { provide: PUSH_QUEUE, useClass: BullmqPushQueue },
  ],
  exports: [PushService],
})
export class PushModule {}
