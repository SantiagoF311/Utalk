import { useEffect } from 'react';

import { useSession } from '@/hooks/useSession';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

// Suscripción a las notificaciones nuevas mientras hay sesión. La política
// RLS de `notifications` hace que Supabase solo le mande a cada uno las
// suyas (ver la migración `notifications`). La fila no trae el post ni la
// comunidad, así que se vuelven a pedir la lista y el contador. Un aviso de
// moderación puede cambiar el estado de "Mis reportes": también se marca
// como desactualizado (se vuelve a pedir solo si está en pantalla).
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
        void queryClient.invalidateQueries({ queryKey: queryKeys.myReports });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
