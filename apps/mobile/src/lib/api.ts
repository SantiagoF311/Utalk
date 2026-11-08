import { problemDetailsSchema } from '@utalk/shared';
import type {
  AuthSession,
  CommentView,
  CreateCommentInput,
  CreatePostInput,
  ErrorCode,
  FieldError,
  Community,
  List,
  Panel,
  PostPage,
  PostSort,
  PostView,
  Profile,
  PublicProfile,
  VoteValue,
} from '@utalk/shared';

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
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
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
export type FeedParams = ({ communityId: string } | { panelId: string }) & {
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

// POST / PUT / DELETE con sesión; `body` se manda como JSON si viene.
async function authSend<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: await authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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

  // Perfil de otra persona: apodo, universidad y desde cuándo está.
  getProfile(userId: string) {
    return authGet<PublicProfile>(`/profiles/${encodeURIComponent(userId)}`);
  },

  getCommunities(panelId: string) {
    return authGet<List<Community>>(`/communities?${toQueryString({ panelId })}`);
  },

  getCommunity(communityId: string) {
    return authGet<Community>(`/communities/${encodeURIComponent(communityId)}`);
  },

  getFeed(params: FeedParams) {
    const scope = 'communityId' in params ? { communityId: params.communityId } : { panelId: params.panelId };
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

  createPost(input: CreatePostInput) {
    return authSend<PostView>('POST', '/posts', input);
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
};
