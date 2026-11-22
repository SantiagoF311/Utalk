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
    // Cuándo lo eliminó un moderador (null = no lo eliminó).
    readonly removedAt: Date | null,
    // Ruta de su imagen en el bucket (null = sin imagen).
    readonly imagePath: string | null,
    // Cuándo lo retuvo la moderación por IA (null = no está retenido).
    readonly heldAt: Date | null = null,
  ) {}

  hasImage(): boolean {
    return this.imagePath !== null;
  }

  // Retenido por la IA hasta que un moderador lo revise.
  isHeld(): boolean {
    return this.heldAt !== null;
  }

  // Uno retenido lo ve solo su autor (con "En revisión"); el resto, nadie.
  isVisibleTo(viewerId: string): boolean {
    return !this.isRemoved() && (!this.isHeld() || this.isAuthoredBy(viewerId));
  }

  isAuthoredBy(userId: string): boolean {
    return this.authorId === userId;
  }

  // Eliminado por moderación: deja de existir para todos menos para la
  // moderación (que conserva su historial).
  isRemoved(): boolean {
    return this.removedAt !== null;
  }

  isEditableBy(userId: string): boolean {
    return !this.isRemoved() && this.isAuthoredBy(userId);
  }
}
