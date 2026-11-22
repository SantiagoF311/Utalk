import type { ReportCategory, ReportSource, ReportStatus } from '@utalk/shared';

export class ReportEntity {
  constructor(
    readonly id: string,
    // Número legible para quien reportó ("caso #42").
    readonly caseNumber: number,
    readonly postId: string | null,
    readonly commentId: string | null,
    // null = lo reportó la IA.
    readonly reportedBy: string | null,
    readonly source: ReportSource,
    readonly category: ReportCategory,
    // Detalle opcional que escribió quien reporta.
    readonly reason: string | null,
    readonly status: ReportStatus,
    readonly resolvedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  targetsPost(): boolean {
    return this.postId !== null;
  }

  targetsComment(): boolean {
    return this.commentId !== null;
  }

  isPending(): boolean {
    return this.status === 'pending';
  }
}
