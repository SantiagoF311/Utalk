import { Module } from '@nestjs/common';
import { PROFILE_REPOSITORY } from './domain/profile.repository.js';
import { SupabaseProfileRepository } from './infrastructure/supabase-profile.repository.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

@Module({
  controllers: [ProfilesController],
  providers: [
    ProfilesService,
    { provide: PROFILE_REPOSITORY, useClass: SupabaseProfileRepository },
  ],
  exports: [ProfilesService],
})
export class ProfilesModule {}
