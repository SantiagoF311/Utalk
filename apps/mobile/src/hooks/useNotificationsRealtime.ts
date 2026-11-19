import { useEffect } from 'react';

import { useSession } from '@/hooks/useSession';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

// Suscripción a las notificaciones nuevas mientras hay sesión. La política
// RLS de `notifications` hace que Supabase solo le mande a cada uno las
// suyas (ver la migración `notifications`). La fila no trae el post ni la
// comunidad, así que se vuelven a pedir la lista y el contador.
export function useNotificationsRealtime() {
  const session = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
        void queryClient.invalidateQueries({ queryKey: queryKeys.unreadNotifications });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
