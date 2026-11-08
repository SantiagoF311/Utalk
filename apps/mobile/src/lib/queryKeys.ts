import type { PostSort, SearchSort } from '@utalk/shared';

// Claves de la caché en un solo lugar: así invalidar (ej. después de postear)
// usa exactamente la misma clave que la query.
export const queryKeys = {
  me: ['me'] as const,
  panels: ['panels'] as const,
  profile: (userId: string) => ['profile', userId] as const,
  communities: (panelId: string) => ['communities', { panelId }] as const,
  community: (communityId: string) => ['community', communityId] as const,
  feed: (scope: { communityId: string } | { panelId: string }, sort: PostSort) =>
    ['feed', scope, sort] as const,
  post: (postId: string) => ['post', postId] as const,
  comments: (postId: string) => ['comments', postId] as const,
  search: (panelId: string, q: string, sort: SearchSort) => ['search', { panelId, q, sort }] as const,
  // No vienen de la API: se guardan en el dispositivo (ver useRecentCommunities
  // y useRecentSearches).
  recentCommunities: ['recentCommunities'] as const,
  recentSearches: ['recentSearches'] as const,
};
