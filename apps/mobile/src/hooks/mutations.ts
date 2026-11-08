import type {
  CommentView,
  CommunityView,
  CreateCommentInput,
  CreateCommunityInput,
  CreatePostInput,
  List,
  PostPage,
  PostView,
  ReportCategory,
  VoteValue,
} from '@utalk/shared';
import { InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { settleLater } from '@/lib/settledSync';

// Tocar la flecha que ya está marcada quita el voto; la otra lo cambia.
export function nextVote(current: VoteValue | null, pressed: VoteValue): VoteValue | null {
  return current === pressed ? null : pressed;
}

type VoteChange = { from: VoteValue | null; to: VoteValue | null };

// Cuánto cambia el puntaje al pasar de un voto a otro (ej. de ↓ a ↑ son +2).
function scoreDelta({ from, to }: VoteChange): number {
  return (to ?? 0) - (from ?? 0);
}

// Un mismo post vive en varias cachés: cada feed donde aparece (por panel,
// comunidad y orden) y su detalle. Se actualizan todas para que el cambio se
// vea igual en todos lados.
function updatePostEverywhere(postId: string, update: (post: PostView) => PostView) {
  queryClient.setQueriesData<InfiniteData<PostPage>>({ queryKey: ['feed'] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((post) => (post.id === postId ? update(post) : post)),
          })),
        }
      : data,
  );
  queryClient.setQueryData<PostView>(queryKeys.post(postId), (post) => (post ? update(post) : post));
}

function removePostEverywhere(postId: string) {
  queryClient.setQueriesData<InfiniteData<PostPage>>({ queryKey: ['feed'] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.filter((post) => post.id !== postId),
          })),
        }
      : data,
  );
  queryClient.removeQueries({ queryKey: queryKeys.post(postId) });
  queryClient.removeQueries({ queryKey: queryKeys.comments(postId) });
}

function updateCommentInTree(postId: string, commentId: string, update: (comment: CommentView) => CommentView) {
  const mapTree = (comments: CommentView[]): CommentView[] =>
    comments.map((comment) =>
      comment.id === commentId ? update(comment) : { ...comment, replies: mapTree(comment.replies) },
    );
  queryClient.setQueryData<List<CommentView>>(queryKeys.comments(postId), (list) =>
    list ? { ...list, items: mapTree(list.items) } : list,
  );
}

// El voto que muestra la caché ahora (lo último que se tocó): del detalle, o
// del primer feed donde aparezca.
function currentPostVote(postId: string): VoteValue | null | undefined {
  const detail = queryClient.getQueryData<PostView>(queryKeys.post(postId));
  if (detail) return detail.myVote;
  for (const [, data] of queryClient.getQueriesData<InfiniteData<PostPage>>({ queryKey: ['feed'] })) {
    const post = data?.pages.flatMap((page) => page.items).find((p) => p.id === postId);
    if (post) return post.myVote;
  }
  return undefined;
}

function currentCommentVote(postId: string, commentId: string): VoteValue | null | undefined {
  const find = (comments: CommentView[]): CommentView | undefined => {
    for (const comment of comments) {
      if (comment.id === commentId) return comment;
      const found = find(comment.replies);
      if (found) return found;
    }
    return undefined;
  };
  const list = queryClient.getQueryData<List<CommentView>>(queryKeys.comments(postId));
  return list ? find(list.items)?.myVote : undefined;
}

// Votar: la flecha y el puntaje cambian al instante en todas las copias; al
// servidor va solo el voto final cuando se deja de tocar (ver settleLater). Si
// falla, se vuelve a pedir el post para mostrar lo que de verdad quedó.
export function votePost(post: PostView, pressed: VoteValue) {
  const from = currentPostVote(post.id) ?? post.myVote;
  const to = nextVote(from, pressed);
  updatePostEverywhere(post.id, (p) => ({ ...p, myVote: to, score: p.score + scoreDelta({ from, to }) }));

  settleLater(`post-vote:${post.id}`, {
    before: from,
    current: () => currentPostVote(post.id) ?? null,
    send: async (desired) => {
      if (desired === null) await api.removePostVote(post.id);
      else await api.votePost(post.id, desired);
      return desired;
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.post(post.id) });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function voteComment(comment: CommentView, pressed: VoteValue) {
  const { postId, id } = comment;
  const from = currentCommentVote(postId, id) ?? comment.myVote;
  const to = nextVote(from, pressed);
  updateCommentInTree(postId, id, (c) => ({ ...c, myVote: to, score: c.score + scoreDelta({ from, to }) }));

  settleLater(`comment-vote:${id}`, {
    before: from,
    current: () => currentCommentVote(postId, id) ?? null,
    send: async (desired) => {
      if (desired === null) await api.removeCommentVote(id);
      else await api.voteComment(id, desired);
      return desired;
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: queryKeys.comments(postId) }),
  });
}

export function useCreatePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => api.createPost(input),
    onSuccess: (post) => {
      // El detalle se abre al instante con lo que devolvió el servidor, y los
      // feeds se vuelven a pedir para que aparezca.
      client.setQueryData(queryKeys.post(post.id), post);
      void client.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useDeletePost() {
  return useMutation({
    mutationFn: (postId: string) => api.deletePost(postId),
    onSuccess: (_result, postId) => removePostEverywhere(postId),
  });
}

export function useCreateComment(postId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateCommentInput, 'postId'>) => api.createComment({ ...input, postId }),
    onSuccess: () => {
      // El árbol se vuelve a pedir (el comentario nuevo va en su lugar del
      // hilo) y el contador del post sube en todos lados.
      void client.invalidateQueries({ queryKey: queryKeys.comments(postId) });
      updatePostEverywhere(postId, (post) => ({ ...post, commentCount: post.commentCount + 1 }));
    },
  });
}

// La misma comunidad vive en la lista de su panel y en su detalle: se
// actualizan las dos (igual que un post en sus feeds).
function updateCommunityEverywhere(
  community: { id: string; panelId: string },
  update: (community: CommunityView) => CommunityView,
) {
  queryClient.setQueryData<List<CommunityView>>(queryKeys.communities(community.panelId), (list) =>
    list ? { ...list, items: list.items.map((c) => (c.id === community.id ? update(c) : c)) } : list,
  );
  queryClient.setQueryData<CommunityView>(queryKeys.community(community.id), (c) => (c ? update(c) : c));
}

// Lo que muestra el botón de unirse ahora (lo último que se tocó).
function currentJoined(communityId: string, panelId: string): boolean | undefined {
  return (
    queryClient.getQueryData<CommunityView>(queryKeys.community(communityId))?.joinedByMe ??
    queryClient
      .getQueryData<List<CommunityView>>(queryKeys.communities(panelId))
      ?.items.find((c) => c.id === communityId)?.joinedByMe
  );
}

// Unirse / salirse: el botón y el contador cambian al instante; al servidor va
// solo el estado final cuando se deja de tocar (ver settleLater). La
// respuesta trae el contador real (por si otros se unieron mientras tanto).
export function toggleMembership(community: CommunityView) {
  const { id, panelId } = community;
  const joined = currentJoined(id, panelId) ?? community.joinedByMe;
  updateCommunityEverywhere(community, (c) => ({
    ...c,
    joinedByMe: !joined,
    memberCount: c.memberCount + (joined ? -1 : 1),
  }));

  let fresh: CommunityView | undefined;
  settleLater(`membership:${id}`, {
    before: joined,
    current: () => currentJoined(id, panelId) ?? !joined,
    send: async (desired) => {
      fresh = desired ? await api.joinCommunity(id) : await api.leaveCommunity(id);
      return fresh.joinedByMe;
    },
    onSettled: () => {
      const settled = fresh;
      if (settled) updateCommunityEverywhere(settled, () => settled);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.community(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.communities(panelId) });
    },
  });
}

export function useCreateCommunity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommunityInput) => api.createCommunity(input),
    onSuccess: (community) => {
      client.setQueryData(queryKeys.community(community.id), community);
      void client.invalidateQueries({ queryKey: queryKeys.communities(community.panelId) });
    },
  });
}

export type ReportTarget = { kind: 'post'; postId: string } | { kind: 'comment'; postId: string; commentId: string };

// Al reportar, el contenido queda oculto para quien reportó (con "Ver
// igual") en todas las cachés donde aparece. No es optimista: la pantalla de
// "listo" se muestra recién cuando el servidor lo confirmó.
export function useReport() {
  return useMutation({
    mutationFn: ({ target, category, reason }: { target: ReportTarget; category: ReportCategory; reason: string }) =>
      api.createReport({
        postId: target.kind === 'post' ? target.postId : null,
        commentId: target.kind === 'comment' ? target.commentId : null,
        category,
        reason,
      }),
    onSuccess: (_report, { target }) => {
      if (target.kind === 'post') {
        updatePostEverywhere(target.postId, (post) => ({ ...post, reportedByMe: true }));
      } else {
        updateCommentInTree(target.postId, target.commentId, (comment) => ({ ...comment, reportedByMe: true }));
      }
    },
  });
}

// El comentario queda como "[eliminado]" con sus respuestas, y sigue
// contando en el total del post (ver la migración de contadores).
export function useDeleteComment(postId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.deleteComment(commentId),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.comments(postId) }),
  });
}
