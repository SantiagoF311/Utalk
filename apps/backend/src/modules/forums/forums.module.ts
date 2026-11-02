import { Module } from '@nestjs/common';
import { PanelsModule } from '../panels/panels.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { FORUM_REPOSITORY } from './domain/forum.repository.js';
import { FORUM_MODERATOR_REPOSITORY } from './domain/forumModerator.repository.js';
import { ForumsController } from './forums.controller.js';
import { ForumsService } from './forums.service.js';
import { SupabaseForumRepository } from './infrastructure/supabase-forum.repository.js';
import { SupabaseForumModeratorRepository } from './infrastructure/supabase-forumModerator.repository.js';

@Module({
  imports: [PanelsModule, ProfilesModule],
  controllers: [ForumsController],
  providers: [
    ForumsService,
    { provide: FORUM_REPOSITORY, useClass: SupabaseForumRepository },
    { provide: FORUM_MODERATOR_REPOSITORY, useClass: SupabaseForumModeratorRepository },
  ],
  exports: [ForumsService],
})
export class ForumsModule {}
