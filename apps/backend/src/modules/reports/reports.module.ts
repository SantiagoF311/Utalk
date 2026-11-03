import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { REPORT_REPOSITORY } from './domain/report.repository.js';
import { SupabaseReportRepository } from './infrastructure/supabase-report.repository.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [PostsModule, CommentsModule, ProfilesModule],
  controllers: [ReportsController],
  providers: [ReportsService, { provide: REPORT_REPOSITORY, useClass: SupabaseReportRepository }],
  exports: [ReportsService],
})
export class ReportsModule {}
