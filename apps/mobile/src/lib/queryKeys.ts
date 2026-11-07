import type { PostSort } from '@utalk/shared';

// Claves de la caché en un solo lugar: así invalidar (ej. después de postear)
// usa exactamente la misma clave que la query.
export const queryKeys = {
  me: ['me'] as const,
  panels: ['panels'] as const,
  panel: (panelId: string) => ['panels', panelId] as const,
  communities: (panelId: string) => ['communities', { panelId }] as const,
  community: (communityId: string) => ['community', communityId] as const,
  feed: (scope: { communityId: string } | { panelId: string }, sort: PostSort) =>
    ['feed', scope, sort] as const,
  post: (postId: string) => ['post', postId] as const,
  comments: (postId: string) => ['comments', postId] as const,
};
