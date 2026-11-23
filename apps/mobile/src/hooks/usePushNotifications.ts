import { pushMessageDataSchema } from '@utalk/shared';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { markNotificationReadById } from '@/hooks/mutations';
import { useSession } from '@/hooks/useSession';
import { requestBrowserNotificationPermission } from '@/lib/browserNotifications';
import { openNotificationLink } from '@/lib/notificationLinks';
import { registerForPush } from '@/lib/pushNotifications';

// Tocar un push: un mensaje abre su conversación; una notificación se marca
// como leída y abre lo mismo que tocarla en la lista.
function openFromPush(response: Notifications.NotificationResponse) {
  const data = pushMessageDataSchema.safeParse(response.notification.request.content.data);
  if (!data.success) return;
  if ('conversationId' in data.data) {
    router.push({
      pathname: '/chat/[conversationId]',
      params: { conversationId: data.data.conversationId },
    });
    return;
  }
  markNotificationReadById(data.data.notificationId);
  openNotificationLink(data.data.link, data.data.postId, 'alert');
}

// Montado en el layout del drawer (solo con sesión): registra el celular
// para recibir push y abre lo que corresponda al tocar un aviso.
export function usePushNotifications() {
  const session = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    if (Platform.OS === 'web') {
      requestBrowserNotificationPermission();
      return;
    }
    // Sin push la app funciona igual (ej. Expo Go en Android): no es un error para el usuario.
    registerForPush().catch((error: unknown) => console.warn('Push registration failed', error));
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // La app estaba cerrada y se abrió tocando un aviso. Se limpia para no
    // volver a abrirlo la próxima vez que arranque.
    const launch = Notifications.getLastNotificationResponse();
    if (launch) {
      Notifications.clearLastNotificationResponse();
      openFromPush(launch);
    }

    // La app estaba abierta o en segundo plano.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      Notifications.clearLastNotificationResponse();
      openFromPush(response);
    });
    return () => subscription.remove();
  }, []);
}
