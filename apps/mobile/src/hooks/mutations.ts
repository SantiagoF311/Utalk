import type {
  CommentView,
  CommunityView,
  ConversationView,
  CreateCommentInput,
  CreateCommunityInput,
  CreatePostInput,
  List,
  ModerationAction,
  ModerationCase,
  PostPage,
  PostView,
  ProfileComment,
  ProfileCommentPage,
  PublicProfile,
  ReportCategory,
  StartConversationInput,
  UpdateMyProfileInput,
  VoteValue,
} from '@utalk/shared';
import { InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';

import { useMyProfile } from '@/hooks/queries';
import { api } from '@/lib/api';
import {
  addPendingMessage,
  ChatMessage,
  confirmPendingMessage,
  failPendingMessage,
  newLocalMessageId,
  refreshConversation,
  removeMessageFromCache,
} from '@/lib/chatCache';
import { errorMessage } from '@/lib/errorMessages';
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

// Un comentario también vive en la lista de comentarios del perfil de su
// autor (otra caché, paginada): se actualiza ahí igual.
function updateAuthorComment(commentId: string, update: (comment: ProfileComment) => ProfileComment) {
  queryClient.setQueriesData<InfiniteData<ProfileCommentPage>>({ queryKey: ['authorComments'] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((c) => (c.id === commentId ? update(c) : c)),
          })),
        }
      : data,
  );
}

// Los votos recibidos del perfil del autor suben o bajan con cada voto a algo
// suyo (si su perfil está en caché y se ven sus contadores).
function adjustKarma(authorId: string, delta: number) {
  if (delta === 0) return;
  queryClient.setQueryData<PublicProfile>(queryKeys.profile(authorId), (profile) =>
    profile?.stats ? { ...profile, stats: { ...profile.stats, karma: profile.stats.karma + delta } } : profile,
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
  const delta = scoreDelta({ from, to });
  // Los feeds incluyen el del perfil del autor (['feed', { authorId }, …]).
  updatePostEverywhere(post.id, (p) => ({ ...p, myVote: to, score: p.score + delta }));
  adjustKarma(post.author.id, delta);

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
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(post.author.id) });
    },
  });
}

export function voteComment(comment: CommentView, pressed: VoteValue) {
  const { postId, id } = comment;
  const from = currentCommentVote(postId, id) ?? comment.myVote;
  const to = nextVote(from, pressed);
  const delta = scoreDelta({ from, to });
  updateCommentInTree(postId, id, (c) => ({ ...c, myVote: to, score: c.score + delta }));
  updateAuthorComment(id, (c) => ({ ...c, score: c.score + delta }));
  if (comment.author) adjustKarma(comment.author.id, delta);

  settleLater(`comment-vote:${id}`, {
    before: from,
    current: () => currentCommentVote(postId, id) ?? null,
    send: async (desired) => {
      if (desired === null) await api.removeCommentVote(id);
      else await api.voteComment(id, desired);
      return desired;
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(postId) });
      void queryClient.invalidateQueries({ queryKey: ['authorComments'] });
      if (comment.author) void queryClient.invalidateQueries({ queryKey: queryKeys.profile(comment.author.id) });
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

// Cambiar el apodo y/o la privacidad del perfil propio.
export function useUpdateMyProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMyProfileInput) => api.updateMyProfile(input),
    onSuccess: (profile, input) => {
      client.setQueryData(queryKeys.me, profile);
      void client.invalidateQueries({ queryKey: queryKeys.profile(profile.id) });
      // El apodo aparece en todo lo que publicó: se vuelve a pedir lo que lo
      // muestra (feeds, posts, comentarios, búsquedas).
      if (input.username !== undefined) {
        for (const key of ['feed', 'post', 'comments', 'authorComments', 'search']) {
          void client.invalidateQueries({ queryKey: [key] });
        }
      }
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.myReports });
      if (target.kind === 'post') {
        updatePostEverywhere(target.postId, (post) => ({ ...post, reportedByMe: true }));
      } else {
        updateCommentInTree(target.postId, target.commentId, (comment) => ({ ...comment, reportedByMe: true }));
      }
    },
  });
}

// Mandar un mensaje en una conversación. **Optimista**, como WhatsApp: el
// mensaje aparece al instante como "Enviando…" con un id provisional, y se
// reemplaza por el real cuando el servidor lo confirma (por la respuesta o
// por Realtime, lo que llegue primero; ver lib/chatCache.ts). Si el servidor
// lo rechaza (bloqueo, solicitud sin aceptar, sin conexión), queda "No se
// envió" con el motivo y se puede reintentar.
export function useSendMessage(conversationId: string) {
  const me = useMyProfile();
  const mutation = useMutation({
    mutationFn: ({ body }: { body: string; localId: string }) => api.sendMessage(conversationId, body),
    onMutate: ({ body, localId }) => {
      addPendingMessage({
        id: localId,
        conversationId,
        senderId: me.data?.id ?? '',
        body,
        readAt: null,
        createdAt: new Date().toISOString(),
        localStatus: 'sending',
      });
    },
    onSuccess: (message, { localId }) => {
      confirmPendingMessage(localId, message);
      refreshConversation(conversationId);
    },
    onError: (error, { localId }) => failPendingMessage(conversationId, localId, errorMessage(error)),
  });

  const send = (body: string) => mutation.mutate({ body, localId: newLocalMessageId() });

  // Reintentar uno que no se envió: se saca y se manda de nuevo (vuelve a
  // aparecer abajo, como el último).
  const retry = (message: ChatMessage) => {
    removeMessageFromCache(conversationId, message.id);
    send(message.body);
  };

  return { send, retry };
}

// Primer mensaje a alguien: crea la conversación (o usa la que ya había).
export function useStartConversation() {
  return useMutation({
    mutationFn: (input: StartConversationInput) => api.startConversation(input),
    onSuccess: ({ conversation }, { recipientId }) => {
      queryClient.setQueryData(queryKeys.conversation(conversation.id), conversation);
      queryClient.setQueryData(queryKeys.conversationWith(recipientId), conversation);
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

// Al abrir una conversación con mensajes sin leer. El contador de la lista
// baja al instante; el otro ve "Visto" por Realtime. Una solicitud recibida
// no se marca (el backend tampoco lo haría): quien la mandó no sabe si la
// viste hasta que respondas.
export function markConversationRead(conversation: ConversationView) {
  if (conversation.unreadCount === 0 || conversation.status === 'request_received') return;
  const clear = (c: ConversationView) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c);
  queryClient.setQueryData<List<ConversationView>>(queryKeys.conversations, (list) =>
    list ? { ...list, items: list.items.map(clear) } : list,
  );
  queryClient.setQueryData<ConversationView>(queryKeys.conversation(conversation.id), (c) => (c ? clear(c) : c));
  void api.markConversationRead(conversation.id).catch(() => refreshConversation(conversation.id));
}

// Bloquear / desbloquear. Como WhatsApp, la conversación se queda en la lista
// (marcada); cambia su `blockedByMe`, así que se vuelven a pedir las
// conversaciones y su detalle.
export function useToggleBlock() {
  return useMutation({
    mutationFn: ({ userId, block }: { userId: string; block: boolean }) =>
      block ? api.blockUser(userId) : api.unblockUser(userId),
    onSuccess: (_result, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.blocks });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      void queryClient.invalidateQueries({ queryKey: ['conversation'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversationWith(userId) });
    },
  });
}

// Resolver un caso de la cola (eliminar o dejar). Sale de la cola en todas
// sus vistas; si se eliminó, también desaparece de feeds y del árbol de
// comentarios. Otro moderador puede haberse adelantado (NO_PENDING_REPORTS):
// igual se vuelve a pedir la cola.
export function useResolveReports() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { entry: ModerationCase; action: ModerationAction }) =>
      api.resolveReports({
        postId: input.entry.commentId === null ? input.entry.postId : null,
        commentId: input.entry.commentId,
        action: input.action,
      }),
    onSuccess: (_result, { entry, action }) => {
      if (action === 'remove' && entry.commentId === null) {
        removePostEverywhere(entry.postId);
      }
    },
    onSettled: (_result, _error, { entry }) => {
      void client.invalidateQueries({ queryKey: ['moderationQueue'] });
      if (entry.commentId !== null) {
        // El comentario pasa a "eliminado por moderación" en su post.
        void client.invalidateQueries({ queryKey: queryKeys.comments(entry.postId) });
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
