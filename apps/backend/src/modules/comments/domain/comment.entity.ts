export class CommentEntity {
  constructor(
    readonly id: string,
    readonly postId: string,
    readonly parentId: string | null,
    readonly authorId: string,
    readonly body: string,
    readonly score: number,
    readonly deletedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  isRoot(): boolean {
    return this.parentId === null;
  }

  belongsToPost(postId: string): boolean {
    return this.postId === postId;
  }

  // Borrado lógico: el comentario conserva su lugar en el hilo (para no
  // perder las respuestas) pero ya no se puede editar, votar ni responder.
  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  isEditableBy(userId: string): boolean {
    return !this.isDeleted() && this.authorId === userId;
  }
}
