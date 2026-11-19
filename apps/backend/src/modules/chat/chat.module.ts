import { Module } from '@nestjs/common';
import { BlocksModule } from '../blocks/blocks.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { PushModule } from '../push/push.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { CONVERSATION_REPOSITORY } from './domain/conversation.repository.js';
import { MESSAGE_REPOSITORY } from './domain/message.repository.js';
import { SupabaseConversationRepository } from './infrastructure/supabase-conversation.repository.js';
import { SupabaseMessageRepository } from './infrastructure/supabase-message.repository.js';

@Module({
  imports: [ProfilesModule, BlocksModule, PushModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    { provide: CONVERSATION_REPOSITORY, useClass: SupabaseConversationRepository },
    { provide: MESSAGE_REPOSITORY, useClass: SupabaseMessageRepository },
  ],
})
export class ChatModule {}
