export class CommentEntity {
  constructor(
    readonly id: string,
    readonly postId: string,
    readonly parentId: string | null,
    readonly authorId: string,
    readonly body: string,
    readonly createdAt: Date,
  ) {}

  isRoot(): boolean {
    return this.parentId === null;
  }

  belongsToPost(postId: string): boolean {
    return this.postId === postId;
  }

  isEditableBy(userId: string): boolean {
    return this.authorId === userId;
  }
}
