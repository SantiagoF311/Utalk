export class PostEntity {
  constructor(
    readonly id: string,
    readonly communityId: string,
    readonly authorId: string,
    readonly title: string,
    readonly body: string,
    readonly score: number,
    readonly commentCount: number,
    readonly createdAt: Date,
  ) {}

  isEditableBy(userId: string): boolean {
    return this.authorId === userId;
  }
}
