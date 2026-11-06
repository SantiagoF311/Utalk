import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DEFAULT_RATE_LIMIT } from './common/rateLimits.js';
import { AdminGuard } from './modules/auth/admin.guard.js';
import { AuthGuard } from './modules/auth/auth.guard.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CommentsModule } from './modules/comments/comments.module.js';
import { ForumsModule } from './modules/forums/forums.module.js';
import { PanelsModule } from './modules/panels/panels.module.js';
import { PostsModule } from './modules/posts/posts.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { UniversitiesModule } from './modules/universities/universities.module.js';
import { VotesModule } from './modules/votes/votes.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([DEFAULT_RATE_LIMIT]),
    SupabaseModule,
    UniversitiesModule,
    ProfilesModule,
    AuthModule,
    PanelsModule,
    ForumsModule,
    PostsModule,
    CommentsModule,
    VotesModule,
    ReportsModule,
  ],
  controllers: [AppController],
  // El orden importa: el rate limiting va primero (frena también a quien
  // manda tokens inválidos en masa), y AdminGuard lee el userId que deja
  // AuthGuard.
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AdminGuard },
  ],
})
export class AppModule {}
