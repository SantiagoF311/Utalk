import { pushMessageDataSchema } from '@utalk/shared';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useSession } from '@/hooks/useSession';
import { requestBrowserNotificationPermission } from '@/lib/browserNotifications';
import { registerForPush } from '@/lib/pushNotifications';

function openConversation(response: Notifications.NotificationResponse) {
  const data = pushMessageDataSchema.safeParse(response.notification.request.content.data);
  if (!data.success) return;
  router.push({
    pathname: '/chat/[conversationId]',
    params: { conversationId: data.data.conversationId },
  });
}

// Montado en el layout del drawer (solo con sesión): registra el celular
// para recibir push y abre la conversación al tocar un aviso.
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
    // volver a abrir esa conversación la próxima vez que arranque.
    const launch = Notifications.getLastNotificationResponse();
    if (launch) {
      Notifications.clearLastNotificationResponse();
      openConversation(launch);
    }

    // La app estaba en segundo plano.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      Notifications.clearLastNotificationResponse();
      openConversation(response);
    });
    return () => subscription.remove();
  }, []);
}
