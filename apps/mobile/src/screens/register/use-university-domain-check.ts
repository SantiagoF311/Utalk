import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

const DEBOUNCE_MS = 400;

export type UniversityDomainCheck =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'registered'; universityName: string }
  | { status: 'unregistered' };

type Result =
  | { domain: string; status: 'registered'; universityName: string }
  | { domain: string; status: 'unregistered' };

export function useUniversityDomainCheck(email: string, isEmailValid: boolean): UniversityDomainCheck {
  const [result, setResult] = useState<Result | null>(null);
  const domain = isEmailValid ? email.split('@')[1]?.toLowerCase() : undefined;

  useEffect(() => {
    if (!domain) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      const { data, error } = await supabase
        .from('universities')
        .select('name')
        .eq('email_domain', domain)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error('useUniversityDomainCheck: failed to query universities', error);
      }
      setResult(data ? { domain, status: 'registered', universityName: data.name } : { domain, status: 'unregistered' });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [domain]);

  if (!domain) return { status: 'idle' };
  if (result && result.domain === domain) return result;
  return { status: 'checking' };
}
