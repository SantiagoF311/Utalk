import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AUTH_REPOSITORY } from './domain/auth.repository.js';
import { SupabaseAuthRepository } from './infrastructure/supabase-auth.repository.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { UniversitiesModule } from '../universities/universities.module.js';

@Module({
  imports: [ProfilesModule, UniversitiesModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTH_REPOSITORY, useClass: SupabaseAuthRepository },
  ],
})
export class AuthModule {}
