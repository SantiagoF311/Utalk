import type { Community } from '@utalk/shared';
import type { CommunityEntity } from './domain/community.entity.js';

export function toCommunityView(community: CommunityEntity): Community {
  return {
    id: community.id,
    panelId: community.panelId,
    slug: community.slug,
    name: community.name,
    createdBy: community.createdBy,
    createdAt: community.createdAt.toISOString(),
  };
}
