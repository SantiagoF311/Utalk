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
    // Cuándo lo eliminó un moderador. Eliminarlo también llena deletedAt,
    // así que todo lo que vale para un borrado vale para este.
    readonly removedAt: Date | null,
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

  // Borrado por un moderador, no por su autor.
  isRemoved(): boolean {
    return this.removedAt !== null;
  }

  isAuthoredBy(userId: string): boolean {
    return this.authorId === userId;
  }

  isEditableBy(userId: string): boolean {
    return !this.isDeleted() && this.isAuthoredBy(userId);
  }
}
