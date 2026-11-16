// Un bloqueo: `blockerId` dejó de recibir mensajes de `blockedId`.
export class BlockEntity {
  constructor(
    readonly blockerId: string,
    readonly blockedId: string,
    readonly createdAt: Date,
  ) {}

  // Si este bloqueo corta la comunicación entre esos dos (en cualquier
  // sentido: tampoco quien bloqueó le puede escribir al bloqueado).
  isBetween(userId: string, otherUserId: string): boolean {
    return (
      (this.blockerId === userId && this.blockedId === otherUserId) ||
      (this.blockerId === otherUserId && this.blockedId === userId)
    );
  }
}
