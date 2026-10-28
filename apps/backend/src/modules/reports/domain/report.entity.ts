export class ReportEntity {
  constructor(
    readonly id: string,
    readonly postId: string | null,
    readonly commentId: string | null,
    readonly reportedBy: string,
    readonly reason: string,
    readonly createdAt: Date,
  ) {}

  targetsPost(): boolean {
    return this.postId !== null;
  }

  targetsComment(): boolean {
    return this.commentId !== null;
  }
}
