import { POST_IMAGE_FIELD, problemDetailsSchema } from '@utalk/shared';
import type {
  AuthSession,
  BlockedUser,
  CommentView,
  ConversationView,
  MessagePage,
  MessageView,
  StartConversationInput,
  StartConversationResult,
  CreateCommentInput,
  CreatePostInput,
  CreateReportInput,
  ErrorCode,
  FieldError,
  CommunityView,
  CreateCommunityInput,
  List,
  ModerationCase,
  ModerationScope,
  MyReport,
  NotificationView,
  Panel,
  PostPage,
  PostSort,
  PostView,
  Profile,
  ProfileCommentPage,
  PublicProfile,
  RegisterPushTokenInput,
  Report,
  ResolveReportsInput,
  ResolveReportsResult,
  UpdateMyProfileInput,
  SearchPage,
  SearchSort,
  UnreadNotificationCount,
  VoteValue,
} from '@utalk/shared';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

import { resolveApiUrl } from '@/lib/apiUrl';
import { supabase } from '@/lib/supabase';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!configuredApiUrl) {
  throw new Error('Missing EXPO_PUBLIC_API_URL');
}

const apiUrl = resolveApiUrl(configuredApiUrl);

// Error de la API (Problem Details, RFC 9457). Para decidir qué hacer o qué
// texto mostrar, usar `code`; `message` es el `detail` técnico en inglés,
// pensado para logs, no para el usuario.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ErrorCode,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  // Con FormData (subir una imagen) el Content-Type lo pone fetch, con el
  // `boundary` del multipart; si se fija a mano, el backend no lo puede leer.
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: isForm ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
  });

  // 204 (ej. un DELETE) no trae cuerpo.
  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const problem = problemDetailsSchema.safeParse(body);
    if (problem.success) {
      throw new ApiError(problem.data.detail, response.status, problem.data.code, problem.data.errors);
    }
    // Respuesta que no vino del backend (proxy, hosting caído…).
    throw new ApiError('Request failed', response.status, 'INTERNAL_ERROR');
  }
  return body as T;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new ApiError('Not signed in', 401, 'UNAUTHENTICATED');
  }
  return { Authorization: `Bearer ${accessToken}` };
}

// Feed de una comunidad o de un panel (exactamente uno de los dos), paginado por
// cursor: `cursor` es el `nextCursor` de la página anterior.
// De qué es un feed: una comunidad, un panel (todas sus comunidades) o un
// autor (su perfil).
export type FeedScope = { communityId: string } | { panelId: string } | { authorId: string };

export type FeedParams = FeedScope & {
  sort: PostSort;
  cursor?: string;
};

function toQueryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  return new URLSearchParams(entries).toString();
}

async function authGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET', headers: await authHeaders() });
}

// POST / PUT / PATCH / DELETE con sesión; `body` se manda como JSON si viene
// (o tal cual si es FormData).
async function authSend<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>(path, {
    method,
    headers: await authHeaders(),
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
}

// En la web el selector da un File de verdad; en iOS/Android, una ruta local
// que React Native sube leyendo el archivo (el objeto { uri, name, type }).
function appendImage(form: FormData, image: ImagePickerAsset) {
  if (Platform.OS === 'web' && image.file) {
    form.append(POST_IMAGE_FIELD, image.file);
    return;
  }
  const file = {
    uri: image.uri,
    name: image.fileName ?? 'imagen.jpg',
    type: image.mimeType ?? 'image/jpeg',
  };
  form.append(POST_IMAGE_FIELD, file as unknown as Blob);
}

export const api = {
  async completeRegistration(username: string) {
    return request<Profile>('/auth/complete-registration', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ username }),
    });
  },

  async getMyProfile() {
    return request<Profile>('/auth/me', {
      method: 'GET',
      headers: await authHeaders(),
    });
  },

  login(identifier: string, password: string) {
    return request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
  },

  checkUsernameAvailable(username: string) {
    return request<{ available: boolean }>(
      `/profiles/check-username/${encodeURIComponent(username)}`,
      { method: 'GET' },
    );
  },

  getPanels() {
    return authGet<List<Panel>>('/panels');
  },

  // Perfil de alguien (o el propio): apodo, universidad, desde cuándo está y
  // contadores (null si es privado y no es el propio).
  getProfile(userId: string) {
    return authGet<PublicProfile>(`/profiles/${encodeURIComponent(userId)}`);
  },

  // Cambiar el apodo y/o la privacidad del perfil propio.
  updateMyProfile(input: UpdateMyProfileInput) {
    return authSend<Profile>('PATCH', '/profiles/me', input);
  },

  // Comentarios de alguien para su perfil, del más nuevo al más viejo.
  getAuthorComments(authorId: string, cursor?: string) {
    return authGet<ProfileCommentPage>(
      `/comments/by-author/${encodeURIComponent(authorId)}?${toQueryString({ cursor })}`,
    );
  },

  getCommunities(panelId: string) {
    return authGet<List<CommunityView>>(`/communities?${toQueryString({ panelId })}`);
  },

  getCommunity(communityId: string) {
    return authGet<CommunityView>(`/communities/${encodeURIComponent(communityId)}`);
  },

  createCommunity(input: CreateCommunityInput) {
    return authSend<CommunityView>('POST', '/communities', input);
  },

  // Unirse / salirse: idempotentes, devuelven la comunidad con el contador nuevo.
  joinCommunity(communityId: string) {
    return authSend<CommunityView>('PUT', `/communities/${encodeURIComponent(communityId)}/membership`);
  },

  leaveCommunity(communityId: string) {
    return authSend<CommunityView>('DELETE', `/communities/${encodeURIComponent(communityId)}/membership`);
  },

  getFeed(params: FeedParams) {
    const scope =
      'communityId' in params
        ? { communityId: params.communityId }
        : 'panelId' in params
          ? { panelId: params.panelId }
          : { authorId: params.authorId };
    return authGet<PostPage>(
      `/posts?${toQueryString({ ...scope, sort: params.sort, cursor: params.cursor })}`,
    );
  },

  getPost(postId: string) {
    return authGet<PostView>(`/posts/${encodeURIComponent(postId)}`);
  },

  // Árbol completo: cada comentario trae sus respuestas en `replies`.
  getComments(postId: string) {
    return authGet<List<CommentView>>(`/comments?${toQueryString({ postId })}`);
  },

  // Con imagen va como multipart (los mismos campos más `image`); sin, JSON.
  createPost(input: CreatePostInput, image: ImagePickerAsset | null = null) {
    if (!image) {
      return authSend<PostView>('POST', '/posts', input);
    }
    const form = new FormData();
    form.append('communityId', input.communityId);
    form.append('title', input.title);
    form.append('body', input.body);
    appendImage(form, image);
    return authSend<PostView>('POST', '/posts', form);
  },

  deletePost(postId: string) {
    return authSend<void>('DELETE', `/posts/${encodeURIComponent(postId)}`);
  },

  // `parentId` null = comentario raíz; si no, respuesta a ese comentario.
  createComment(input: CreateCommentInput) {
    return authSend<CommentView>('POST', '/comments', input);
  },

  // Queda como "[eliminado]" en el árbol, con sus respuestas.
  deleteComment(commentId: string) {
    return authSend<void>('DELETE', `/comments/${encodeURIComponent(commentId)}`);
  },

  // Votar es "poner" (PUT): votar de nuevo cambia el voto. Quitarlo es DELETE.
  votePost(postId: string, value: VoteValue) {
    return authSend<unknown>('PUT', '/votes/posts', { postId, value });
  },

  removePostVote(postId: string) {
    return authSend<void>('DELETE', `/votes/posts/${encodeURIComponent(postId)}`);
  },

  voteComment(commentId: string, value: VoteValue) {
    return authSend<unknown>('PUT', '/votes/comments', { commentId, value });
  },

  removeCommentVote(commentId: string) {
    return authSend<void>('DELETE', `/votes/comments/${encodeURIComponent(commentId)}`);
  },

  // Publicaciones y comentarios de un panel o de una comunidad (nunca apodos).
  search(
    params: ({ panelId: string } | { communityId: string }) & {
      q: string;
      sort: SearchSort;
      cursor?: string;
    },
  ) {
    return authGet<SearchPage>(`/search?${toQueryString(params)}`);
  },

  // Exactamente uno de postId / commentId.
  createReport(input: CreateReportInput) {
    return authSend<Report>('POST', '/reports', input);
  },

  // Chats: escribir siempre va por acá; los mensajes nuevos y los "Visto"
  // llegan además por Realtime (ver hooks/useChatRealtime.ts).
  getConversations() {
    return authGet<List<ConversationView>>('/conversations');
  },

  getConversation(conversationId: string) {
    return authGet<ConversationView>(`/conversations/${encodeURIComponent(conversationId)}`);
  },

  // La conversación con alguien, si ya existe (404 CONVERSATION_NOT_FOUND si no).
  getConversationWith(userId: string) {
    return authGet<ConversationView>(`/conversations/with/${encodeURIComponent(userId)}`);
  },

  // Del más nuevo al más viejo, paginado por cursor.
  getMessages(conversationId: string, cursor?: string) {
    return authGet<MessagePage>(
      `/conversations/${encodeURIComponent(conversationId)}/messages?${toQueryString({ cursor })}`,
    );
  },

  startConversation(input: StartConversationInput) {
    return authSend<StartConversationResult>('POST', '/conversations', input);
  },

  sendMessage(conversationId: string, body: string) {
    return authSend<MessageView>('POST', `/conversations/${encodeURIComponent(conversationId)}/messages`, {
      body,
    });
  },

  markConversationRead(conversationId: string) {
    return authSend<void>('POST', `/conversations/${encodeURIComponent(conversationId)}/read`);
  },

  getBlocks() {
    return authGet<List<BlockedUser>>('/blocks');
  },

  // Bloquear / desbloquear: idempotentes.
  blockUser(userId: string) {
    return authSend<void>('PUT', `/blocks/${encodeURIComponent(userId)}`);
  },

  unblockUser(userId: string) {
    return authSend<void>('DELETE', `/blocks/${encodeURIComponent(userId)}`);
  },

  // Las más nuevas primero. Las nuevas además llegan por Realtime (ver
  // hooks/useNotificationsRealtime.ts).
  getNotifications() {
    return authGet<List<NotificationView>>('/notifications');
  },

  getUnreadNotificationCount() {
    return authGet<UnreadNotificationCount>('/notifications/unread-count');
  },

  // Idempotentes.
  markNotificationRead(notificationId: string) {
    return authSend<void>('POST', `/notifications/${encodeURIComponent(notificationId)}/read`);
  },

  markAllNotificationsRead() {
    return authSend<void>('POST', '/notifications/read-all');
  },

  // El celular donde avisar de los mensajes nuevos (ver lib/pushNotifications.ts).
  registerPushToken(input: RegisterPushTokenInput) {
    return authSend<void>('PUT', '/push-tokens', input);
  },

  unregisterPushToken(token: string) {
    return authSend<void>('DELETE', `/push-tokens/${encodeURIComponent(token)}`);
  },

  // Mis reportes, con su número de caso y en qué quedaron.
  getMyReports() {
    return authGet<List<MyReport>>('/reports/mine');
  },

  // Qué modera el usuario: si es admin y en qué comunidades es moderador.
  getModerationScope() {
    return authGet<ModerationScope>('/moderation/scope');
  },

  // Sin communityId: todas las comunidades que modera.
  getModerationQueue(communityId?: string) {
    return authGet<List<ModerationCase>>(`/moderation/queue?${toQueryString({ communityId })}`);
  },

  // Cierra todos los reportes pendientes de ese contenido (y lo elimina si
  // la acción es `remove`).
  resolveReports(input: ResolveReportsInput) {
    return authSend<ResolveReportsResult>('POST', '/moderation/resolve', input);
  },
};
