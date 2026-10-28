import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
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
  providers: [AppService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
