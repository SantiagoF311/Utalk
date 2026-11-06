import type { PostSort } from '@utalk/shared';

// Claves de la caché en un solo lugar: así invalidar (ej. después de postear)
// usa exactamente la misma clave que la query.
export const queryKeys = {
  me: ['me'] as const,
  panels: ['panels'] as const,
  panel: (panelId: string) => ['panels', panelId] as const,
  forums: (panelId: string) => ['forums', { panelId }] as const,
  forum: (forumId: string) => ['forum', forumId] as const,
  feed: (scope: { forumId: string } | { panelId: string }, sort: PostSort) =>
    ['feed', scope, sort] as const,
};
