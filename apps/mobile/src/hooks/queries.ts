import { SEARCH_QUERY_MIN_LENGTH } from '@utalk/shared';
import type { PostSort, SearchSort } from '@utalk/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api, ApiError, FeedScope } from '@/lib/api';
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

// Todas mis conversaciones (Chats y Solicitudes se separan por `status`).
// Realtime las invalida cuando llega un mensaje (useChatRealtime).
export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => api.getConversations(),
    select: (list) => list.items,
  });
}

export function useConversation(conversationId: string) {
  return useQuery({
    queryKey: queryKeys.conversation(conversationId),
    queryFn: () => api.getConversation(conversationId),
  });
}

// La conversación con alguien, o null si todavía no hablaron (el 404 no es
// un error acá: es "no hay").
export function useConversationWith(userId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.conversationWith(userId),
    queryFn: async () => {
      try {
        return await api.getConversationWith(userId);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'CONVERSATION_NOT_FOUND') return null;
        throw error;
      }
    },
    enabled: options.enabled ?? true,
  });
}

// Mensajes del más nuevo al más viejo (para una lista invertida): cada
// página trae los anteriores.
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: ({ pageParam }) => api.getMessages(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}

export function useBlocks() {
  return useQuery({
    queryKey: queryKeys.blocks,
    queryFn: () => api.getBlocks(),
    select: (list) => list.items,
  });
}

export function useMyReports() {
  return useQuery({
    queryKey: queryKeys.myReports,
    queryFn: () => api.getMyReports(),
    select: (list) => list.items,
  });
}

// Qué modera el usuario. `canModerate` decide si se muestra la entrada a
// moderación (sidebar y ajustes).
export function useModerationScope() {
  return useQuery({
    queryKey: queryKeys.moderationScope,
    queryFn: () => api.getModerationScope(),
    select: (scope) => ({ ...scope, canModerate: scope.isAdmin || scope.communities.length > 0 }),
    // Ser moderador cambia poco.
    staleTime: 5 * 60_000,
  });
}

// `communityId` null = todas las que modera. Ya viene ordenada por gravedad.
export function useModerationQueue(communityId: string | null) {
  return useQuery({
    queryKey: queryKeys.moderationQueue(communityId),
    queryFn: () => api.getModerationQueue(communityId ?? undefined),
    select: (list) => list.items,
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
