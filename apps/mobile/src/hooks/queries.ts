import { SEARCH_QUERY_MIN_LENGTH } from '@utalk/shared';
import type { PostSort, SearchSort } from '@utalk/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api, FeedScope } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useMyProfile() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => api.getMyProfile() });
}

export function usePanels() {
  return useQuery({
    queryKey: queryKeys.panels,
    queryFn: () => api.getPanels(),
    select: (list) => list.items,
    // Los paneles casi no cambian.
    staleTime: 10 * 60_000,
  });
}

export function useProfile(userId: string) {
  return useQuery({ queryKey: queryKeys.profile(userId), queryFn: () => api.getProfile(userId) });
}

// `panelId` vacío = todavía no se sabe qué panel (ej. Inicio esperando el
// perfil): no se pide nada.
export function useCommunities(panelId: string) {
  return useQuery({
    queryKey: queryKeys.communities(panelId),
    queryFn: () => api.getCommunities(panelId),
    select: (list) => list.items,
    enabled: panelId !== '',
  });
}

export function useCommunity(communityId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.community(communityId),
    queryFn: () => api.getCommunity(communityId),
    enabled: options.enabled ?? true,
  });
}

export function usePost(postId: string) {
  return useQuery({ queryKey: queryKeys.post(postId), queryFn: () => api.getPost(postId) });
}

export function useComments(postId: string) {
  return useQuery({
    queryKey: queryKeys.comments(postId),
    queryFn: () => api.getComments(postId),
    select: (list) => list.items,
  });
}

// Búsqueda paginada (mismo esquema de `nextCursor` que el feed), en un panel
// o en una comunidad. Con menos de SEARCH_QUERY_MIN_LENGTH caracteres, o sin
// panel todavía, no se pide nada.
export function useSearch(scope: SearchScope, q: string, sort: SearchSort) {
  const ready = 'communityId' in scope ? scope.communityId !== '' : scope.panelId !== '';
  return useInfiniteQuery({
    queryKey: queryKeys.search(scope, q, sort),
    queryFn: ({ pageParam }) => api.search({ ...scope, q, sort, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
    enabled: ready && q.length >= SEARCH_QUERY_MIN_LENGTH,
  });
}

export type SearchScope = { panelId: string } | { communityId: string };

// Feed paginado por cursor: cada página trae `nextCursor`, que se manda para
// pedir la siguiente; `null` = no hay más.
export function useFeed(scope: FeedScope, sort: PostSort) {
  return useInfiniteQuery({
    queryKey: queryKeys.feed(scope, sort),
    queryFn: ({ pageParam }) => api.getFeed({ ...scope, sort, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}

// Comentarios de alguien para su perfil, paginados igual que el feed.
export function useAuthorComments(authorId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.authorComments(authorId),
    queryFn: ({ pageParam }) => api.getAuthorComments(authorId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}
