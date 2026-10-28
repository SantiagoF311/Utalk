import type { AuthSession, Profile } from '@utalk/shared';

import { supabase } from '@/lib/supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error('Missing EXPO_PUBLIC_API_URL');
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(body?.message ?? 'Request failed', response.status);
  }
  return body as T;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new ApiError('Not signed in', 401);
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
