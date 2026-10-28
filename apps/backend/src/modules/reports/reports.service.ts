import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateReportInput } from '@utalk/shared';
import { CommentsService } from '../comments/comments.service.js';
import { PostsService } from '../posts/posts.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { ReportEntity } from './domain/report.entity.js';
import { REPORT_REPOSITORY } from './domain/report.repository.js';
import type { ReportRepository, ReportTarget } from './domain/report.repository.js';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(REPORT_REPOSITORY) private readonly reportRepository: ReportRepository,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async create(input: CreateReportInput, reportedBy: string): Promise<ReportEntity> {
    await this.profilesService.findById(reportedBy);
    const target = await this.resolveTarget(input);

    return this.reportRepository.create({
      ...target,
      reportedBy,
      reason: input.reason,
    });
  }

  async findAll(): Promise<ReportEntity[]> {
    return this.reportRepository.findAll();
  }

  async findById(id: string): Promise<ReportEntity> {
    const report = await this.reportRepository.findById(id);
    if (!report) {
      throw new NotFoundException(`Report ${id} not found`);
    }
    return report;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.reportRepository.delete(id);
  }

  // Convierte el input (dos campos nullable, validados con .refine()) en un
  // ReportTarget con exactamente un target, verificando que exista.
  private async resolveTarget(input: CreateReportInput): Promise<ReportTarget> {
    if (input.postId !== null && input.commentId === null) {
      await this.postsService.findById(input.postId);
      return { postId: input.postId, commentId: null };
    }
    if (input.commentId !== null && input.postId === null) {
      await this.commentsService.findById(input.commentId);
      return { postId: null, commentId: input.commentId };
    }
    throw new BadRequestException('Exactly one of postId or commentId must be set');
  }
}
