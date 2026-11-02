export class ForumEntity {
  // `createdBy` es solo histórico: los permisos sobre el foro dependen de
  // forum_moderators, no de quién lo creó.
  constructor(
    readonly id: string,
    readonly panelId: string,
    readonly slug: string,
    readonly name: string,
    readonly createdBy: string,
    readonly createdAt: Date,
  ) {}
}
