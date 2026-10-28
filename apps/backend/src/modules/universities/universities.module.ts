import { Module } from '@nestjs/common';
import { UNIVERSITY_REPOSITORY } from './domain/university.repository.js';
import { SupabaseUniversityRepository } from './infrastructure/supabase-university.repository.js';
import { UniversitiesController } from './universities.controller.js';
import { UniversitiesService } from './universities.service.js';

@Module({
  controllers: [UniversitiesController],
  providers: [
    UniversitiesService,
    { provide: UNIVERSITY_REPOSITORY, useClass: SupabaseUniversityRepository },
  ],
  exports: [UniversitiesService],
})
export class UniversitiesModule {}
