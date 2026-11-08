import type { CommunityTopic } from '@utalk/shared';

export class CommunityEntity {
  // `createdBy` es solo histórico: los permisos sobre la comunidad dependen de
  // community_moderators, no de quién lo creó.
  constructor(
    readonly id: string,
    readonly panelId: string,
    readonly slug: string,
    readonly name: string,
    readonly description: string,
    readonly topic: CommunityTopic,
    readonly memberCount: number,
    readonly createdBy: string,
    readonly createdAt: Date,
  ) {}
}
