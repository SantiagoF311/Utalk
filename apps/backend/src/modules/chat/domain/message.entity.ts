export class MessageEntity {
  constructor(
    readonly id: string,
    readonly conversationId: string,
    readonly senderId: string,
    readonly body: string,
    // Cuándo lo leyó el otro participante.
    readonly readAt: Date | null,
    readonly createdAt: Date,
  ) {}

  isFrom(userId: string): boolean {
    return this.senderId === userId;
  }

  isRead(): boolean {
    return this.readAt !== null;
  }
}
