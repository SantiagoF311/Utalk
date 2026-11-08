import type { ReportCategory } from '@utalk/shared';

export class ReportEntity {
  constructor(
    readonly id: string,
    readonly postId: string | null,
    readonly commentId: string | null,
    readonly reportedBy: string,
    readonly category: ReportCategory,
    // Detalle opcional que escribió quien reporta.
    readonly reason: string | null,
    readonly createdAt: Date,
  ) {}

  targetsPost(): boolean {
    return this.postId !== null;
  }

  targetsComment(): boolean {
    return this.commentId !== null;
  }
}
