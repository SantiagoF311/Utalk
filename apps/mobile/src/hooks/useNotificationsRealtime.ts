import type { List, NotificationView } from '@utalk/shared';
import { useEffect } from 'react';

import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';
import { alertNewNotification } from '@/lib/incomingAlerts';
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
// Además se avisa: aviso interno con la app abierta, o del navegador con la
// pestaña oculta (en el celular en segundo plano lo hace el push).
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
          void refreshList((payload.new as { id?: string }).id);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}

// Vuelve a pedir la lista (trae el post y la comunidad de la nueva) y avisa
// de esa notificación.
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
    if (created) alertNewNotification(created);
  } catch {
    // Sin la lista no hay aviso; la campana se actualiza igual.
  }
}
