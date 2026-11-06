import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useSession } from '@/hooks/useSession';
import { api, ApiError } from '@/lib/api';

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
// Se revisa cada vez que cambia el usuario con sesión, no en cada renovación
// del token (que cambia la sesión pero no el usuario).
export function useRequireProfile() {
  const userId = useSession()?.user.id;
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!userId || ROUTES_THAT_CREATE_PROFILE.includes(pathnameRef.current)) return;
    void redirectIfProfileMissing();
  }, [userId]);
}
