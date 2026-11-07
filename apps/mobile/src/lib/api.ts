import { problemDetailsSchema } from '@utalk/shared';
import type {
  AuthSession,
  CommentView,
  ErrorCode,
  FieldError,
  Forum,
  List,
  Panel,
  PostPage,
  PostSort,
  PostView,
  Profile,
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

// Feed de un foro o de un panel (exactamente uno de los dos), paginado por
// cursor: `cursor` es el `nextCursor` de la página anterior.
export type FeedParams = ({ forumId: string } | { panelId: string }) & {
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

  getPanel(panelId: string) {
    return authGet<Panel>(`/panels/${encodeURIComponent(panelId)}`);
  },

  getForums(panelId: string) {
    return authGet<List<Forum>>(`/forums?${toQueryString({ panelId })}`);
  },

  getForum(forumId: string) {
    return authGet<Forum>(`/forums/${encodeURIComponent(forumId)}`);
  },

  getFeed(params: FeedParams) {
    const scope = 'forumId' in params ? { forumId: params.forumId } : { panelId: params.panelId };
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
};
