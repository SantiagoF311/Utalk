import type { PostSort, SearchSort } from '@utalk/shared';

import type { FeedScope } from '@/lib/api';

// Claves de la caché en un solo lugar: así invalidar (ej. después de postear)
// usa exactamente la misma clave que la query.
export const queryKeys = {
  me: ['me'] as const,
  panels: ['panels'] as const,
  profile: (userId: string) => ['profile', userId] as const,
  communities: (panelId: string) => ['communities', { panelId }] as const,
  community: (communityId: string) => ['community', communityId] as const,
  feed: (scope: FeedScope, sort: PostSort) => ['feed', scope, sort] as const,
  authorComments: (authorId: string) => ['authorComments', authorId] as const,
  post: (postId: string) => ['post', postId] as const,
  comments: (postId: string) => ['comments', postId] as const,
  myReports: ['myReports'] as const,
  moderationScope: ['moderationScope'] as const,
  // null = todas las comunidades que modera.
  moderationQueue: (communityId: string | null) => ['moderationQueue', communityId] as const,
  search: (scope: { panelId: string } | { communityId: string }, q: string, sort: SearchSort) =>
    ['search', scope, q, sort] as const,
  // No vienen de la API: se guardan en el dispositivo (ver useRecentCommunities
  // y useRecentSearches).
  recentCommunities: ['recentCommunities'] as const,
  recentSearches: ['recentSearches'] as const,
};
