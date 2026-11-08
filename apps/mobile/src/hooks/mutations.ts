import type {
  CommentView,
  CreateCommentInput,
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

// Voto optimista: la flecha y el puntaje cambian al instante; si el servidor
// falla, se deshace exactamente ese cambio (no se restaura una foto vieja de
// la caché, que pisaría otros votos hechos mientras tanto).
export function useVotePost() {
  return useMutation({
    mutationFn: ({ postId, to }: VoteChange & { postId: string }) =>
      to === null ? api.removePostVote(postId) : api.votePost(postId, to),
    onMutate: ({ postId, from, to }) => {
      updatePostEverywhere(postId, (post) => ({
        ...post,
        myVote: to,
        score: post.score + scoreDelta({ from, to }),
      }));
    },
    onError: (_error, { postId, from, to }) => {
      updatePostEverywhere(postId, (post) => ({
        ...post,
        myVote: from,
        score: post.score - scoreDelta({ from, to }),
      }));
    },
  });
}

export function useVoteComment() {
  return useMutation({
    mutationFn: ({ commentId, to }: VoteChange & { postId: string; commentId: string }) =>
      to === null ? api.removeCommentVote(commentId) : api.voteComment(commentId, to),
    onMutate: ({ postId, commentId, from, to }) => {
      updateCommentInTree(postId, commentId, (comment) => ({
        ...comment,
        myVote: to,
        score: comment.score + scoreDelta({ from, to }),
      }));
    },
    onError: (_error, { postId, commentId, from, to }) => {
      updateCommentInTree(postId, commentId, (comment) => ({
        ...comment,
        myVote: from,
        score: comment.score - scoreDelta({ from, to }),
      }));
    },
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
