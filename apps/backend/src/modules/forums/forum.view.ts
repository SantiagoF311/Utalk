import type { Forum } from '@utalk/shared';
import type { ForumEntity } from './domain/forum.entity.js';

export function toForumView(forum: ForumEntity): Forum {
  return {
    id: forum.id,
    panelId: forum.panelId,
    slug: forum.slug,
    name: forum.name,
    createdBy: forum.createdBy,
    createdAt: forum.createdAt.toISOString(),
  };
}
