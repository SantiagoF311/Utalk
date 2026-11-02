import { problemDetailsSchema } from '@utalk/shared';
import type { AuthSession, ErrorCode, FieldError, Profile } from '@utalk/shared';

import { supabase } from '@/lib/supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error('Missing EXPO_PUBLIC_API_URL');
}

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
};
