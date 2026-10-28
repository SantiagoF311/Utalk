import { Module } from '@nestjs/common';
import { PanelsModule } from '../panels/panels.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { FORUM_REPOSITORY } from './domain/forum.repository.js';
import { ForumsController } from './forums.controller.js';
import { ForumsService } from './forums.service.js';
import { SupabaseForumRepository } from './infrastructure/supabase-forum.repository.js';

@Module({
  imports: [PanelsModule, ProfilesModule],
  controllers: [ForumsController],
  providers: [
    ForumsService,
    { provide: FORUM_REPOSITORY, useClass: SupabaseForumRepository },
  ],
  exports: [ForumsService],
})
export class ForumsModule {}
