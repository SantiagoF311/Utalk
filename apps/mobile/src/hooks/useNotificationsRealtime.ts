import type { List, NotificationView } from '@utalk/shared';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';
import { notifyNotificationInBrowser } from '@/lib/browserNotifications';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

// Suscripción a las notificaciones nuevas mientras hay sesión. La política
// RLS de `notifications` hace que Supabase solo le mande a cada uno las
// suyas (ver la migración `notifications`). La fila no trae el post ni la
// comunidad, así que se vuelven a pedir la lista y el contador. Un aviso de
// moderación puede cambiar el estado de "Mis reportes": también se marca
// como desactualizado (se vuelve a pedir solo si está en pantalla).
//
// En la web, además, se avisa con el navegador (en el celular lo hace el
// push, que manda el backend).
export function useNotificationsRealtime() {
  const session = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.unreadNotifications });
          void queryClient.invalidateQueries({ queryKey: queryKeys.myReports });
          void refreshList(Platform.OS === 'web' ? (payload.new as { id?: string }).id : undefined);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}

// Vuelve a pedir la lista (trae el post y la comunidad de la nueva) y, si se
// pide, avisa de esa notificación con el navegador.
async function refreshList(alertId: string | undefined): Promise<void> {
  if (alertId === undefined) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    return;
  }
  try {
    const list = await queryClient.fetchQuery<List<NotificationView>>({
      queryKey: queryKeys.notifications,
      queryFn: () => api.getNotifications(),
      // Siempre al servidor: la del caché todavía no tiene la nueva.
      staleTime: 0,
    });
    const created = list.items.find((notification) => notification.id === alertId);
    if (created) notifyNotificationInBrowser(created);
  } catch {
    // Sin la lista no hay aviso; la campana se actualiza igual.
  }
}
