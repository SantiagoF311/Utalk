import type { PostSort } from '@utalk/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
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

export function usePanel(panelId: string) {
  return useQuery({ queryKey: queryKeys.panel(panelId), queryFn: () => api.getPanel(panelId) });
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

export function useCommunity(communityId: string) {
  return useQuery({ queryKey: queryKeys.community(communityId), queryFn: () => api.getCommunity(communityId) });
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

// Feed paginado por cursor: cada página trae `nextCursor`, que se manda para
// pedir la siguiente; `null` = no hay más.
export function useFeed(scope: { communityId: string } | { panelId: string }, sort: PostSort) {
  return useInfiniteQuery({
    queryKey: queryKeys.feed(scope, sort),
    queryFn: ({ pageParam }) => api.getFeed({ ...scope, sort, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}
