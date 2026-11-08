import { Module } from '@nestjs/common';
import { PanelsModule } from '../panels/panels.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { COMMUNITY_REPOSITORY } from './domain/community.repository.js';
import { COMMUNITY_MEMBER_REPOSITORY } from './domain/communityMember.repository.js';
import { COMMUNITY_MODERATOR_REPOSITORY } from './domain/communityModerator.repository.js';
import { CommunitiesController } from './communities.controller.js';
import { CommunitiesService } from './communities.service.js';
import { SupabaseCommunityRepository } from './infrastructure/supabase-community.repository.js';
import { SupabaseCommunityMemberRepository } from './infrastructure/supabase-communityMember.repository.js';
import { SupabaseCommunityModeratorRepository } from './infrastructure/supabase-communityModerator.repository.js';

@Module({
  imports: [PanelsModule, ProfilesModule],
  controllers: [CommunitiesController],
  providers: [
    CommunitiesService,
    { provide: COMMUNITY_REPOSITORY, useClass: SupabaseCommunityRepository },
    { provide: COMMUNITY_MODERATOR_REPOSITORY, useClass: SupabaseCommunityModeratorRepository },
    { provide: COMMUNITY_MEMBER_REPOSITORY, useClass: SupabaseCommunityMemberRepository },
  ],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
