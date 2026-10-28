export class PostEntity {
  constructor(
    readonly id: string,
    readonly forumId: string,
    readonly authorId: string,
    readonly title: string,
    readonly body: string,
    readonly createdAt: Date,
  ) {}

  isEditableBy(userId: string): boolean {
    return this.authorId === userId;
  }
}
