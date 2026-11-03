import { Module } from '@nestjs/common';
import { UniversitiesModule } from '../universities/universities.module.js';
import { PROFILE_REPOSITORY } from './domain/profile.repository.js';
import { SupabaseProfileRepository } from './infrastructure/supabase-profile.repository.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

@Module({
  imports: [UniversitiesModule],
  controllers: [ProfilesController],
  providers: [
    ProfilesService,
    { provide: PROFILE_REPOSITORY, useClass: SupabaseProfileRepository },
  ],
  exports: [ProfilesService],
})
export class ProfilesModule {}
