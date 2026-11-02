import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { api, ApiError } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// Rutas que crean el perfil ellas mismas: ahí la sesión existe un momento
// sin perfil a propósito, así que no hay que redirigir.
const ROUTES_THAT_CREATE_PROFILE = ['/register', '/complete-profile'];

async function redirectIfProfileMissing() {
  try {
    await api.getMyProfile();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'PROFILE_NOT_FOUND') {
      router.replace('/complete-profile');
      return;
    }
    console.error('useRequireProfile: failed to load profile', error);
  }
}

// Si hay sesión pero no perfil (verificó el correo y cerró la app antes de
// elegir usuario), manda a completar el perfil al abrir la app o al entrar.
export function useRequireProfile() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN')) return;
      if (ROUTES_THAT_CREATE_PROFILE.includes(pathnameRef.current)) return;

      // Supabase pide no esperar otras llamadas suyas dentro de este callback
      // (puede bloquearse); getMyProfile lee la sesión, así que va aparte.
      setTimeout(() => void redirectIfProfileMissing(), 0);
    });

    return () => data.subscription.unsubscribe();
  }, []);
}
