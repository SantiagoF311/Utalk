import type { CommunityView } from '@utalk/shared';
import type { CommunityEntity } from './domain/community.entity.js';

// `joinedByMe` depende de quien mira, no de la comunidad.
export function toCommunityView(community: CommunityEntity, joinedByMe: boolean): CommunityView {
  return {
    id: community.id,
    panelId: community.panelId,
    slug: community.slug,
    name: community.name,
    description: community.description,
    topic: community.topic,
    memberCount: community.memberCount,
    createdBy: community.createdBy,
    createdAt: community.createdAt.toISOString(),
    joinedByMe,
  };
}
