export class ForumEntity {
  constructor(
    readonly id: string,
    readonly panelId: string,
    readonly slug: string,
    readonly name: string,
    readonly createdBy: string,
    readonly createdAt: Date,
  ) {}

  isEditableBy(userId: string): boolean {
    return this.createdBy === userId;
  }
}
