import { router } from 'expo-router';

import { useMyProfile } from '@/hooks/queries';

// Abre el perfil de un usuario (al tocar su apodo). Si eres tú, va a tu
// pestaña Perfil en vez de abrir tu perfil público.
export function useOpenProfile() {
  const me = useMyProfile();

  return (userId: string) => {
    if (userId === me.data?.id) {
      router.navigate('/profile');
    } else {
      router.push({ pathname: '/user/[userId]', params: { userId } });
    }
  };
}
