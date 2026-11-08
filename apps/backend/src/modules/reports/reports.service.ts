import { Inject, Injectable } from '@nestjs/common';
import { CreateReportInput } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { CommentsService } from '../comments/comments.service.js';
import type { CommentEntity } from '../comments/domain/comment.entity.js';
import type { PostEntity } from '../posts/domain/post.entity.js';
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
    const { target, content } = await this.resolveTarget(input);

    // Reportar lo propio no tiene sentido (para eso está borrarlo) y solo
    // llenaría la cola de moderación.
    if (content.isAuthoredBy(reportedBy)) {
      throw new AppException('CANNOT_REPORT_OWN_CONTENT', 'You cannot report your own content');
    }
    // Uno por persona y contenido: reportar diez veces no lo vuelve más
    // urgente. La base también lo frena (índices únicos), por si dos llegan
    // al mismo tiempo.
    if (await this.reportRepository.existsByReporter(target, reportedBy)) {
      throw new AppException('ALREADY_REPORTED', 'You already reported this content');
    }

    return this.reportRepository.create({
      ...target,
      reportedBy,
      category: input.category,
      reason: input.reason,
    });
  }

  async findAll(): Promise<ReportEntity[]> {
    return this.reportRepository.findAll();
  }

  async findById(id: string): Promise<ReportEntity> {
    const report = await this.reportRepository.findById(id);
    if (!report) {
      throw new AppException('REPORT_NOT_FOUND', `Report ${id} not found`);
    }
    return report;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.reportRepository.delete(id);
  }

  // Convierte el input (dos campos nullable, validados con .refine()) en un
  // ReportTarget con exactamente un target, verificando que exista. Devuelve
  // también el post o comentario, para no dejar reportar lo propio.
  private async resolveTarget(
    input: CreateReportInput,
  ): Promise<{ target: ReportTarget; content: PostEntity | CommentEntity }> {
    if (input.postId !== null && input.commentId === null) {
      const post = await this.postsService.findById(input.postId);
      return { target: { postId: input.postId, commentId: null }, content: post };
    }
    if (input.commentId !== null && input.postId === null) {
      const comment = await this.commentsService.findById(input.commentId);
      return { target: { postId: null, commentId: input.commentId }, content: comment };
    }
    throw new AppException('VALIDATION_FAILED', 'Exactly one of postId or commentId must be set');
  }
}
