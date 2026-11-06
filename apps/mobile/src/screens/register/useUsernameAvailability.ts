import { profileSchema } from '@utalk/shared';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

const DEBOUNCE_MS = 400;

export type UsernameAvailability =
  | { status: 'idle' }
  | { status: 'invalid' }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'taken' };

type Result = { username: string; status: 'available' | 'taken' };

export function useUsernameAvailability(username: string): UsernameAvailability {
  const [result, setResult] = useState<Result | null>(null);
  const trimmed = username.trim();
  const isCheckable = profileSchema.shape.username.safeParse(trimmed).success;

  useEffect(() => {
    if (!isCheckable) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const { available } = await api.checkUsernameAvailable(trimmed);
        if (cancelled) return;
        setResult({ username: trimmed, status: available ? 'available' : 'taken' });
      } catch (error) {
        if (cancelled) return;
        console.error('useUsernameAvailability: failed to check username', error);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [trimmed, isCheckable]);

  if (trimmed.length === 0) return { status: 'idle' };
  if (!isCheckable) return { status: 'invalid' };
  if (result && result.username === trimmed) return result;
  return { status: 'checking' };
}
