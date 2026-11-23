import { describeNotification } from '@utalk/shared';
import type { ConversationView, List, MessageView, NotificationView } from '@utalk/shared';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { markNotificationReadById } from '@/hooks/mutations';
import { showBrowserNotification } from '@/lib/browserNotifications';
import { isAppInForeground, showInAppAlert } from '@/lib/inAppAlerts';
import { openNotificationLink } from '@/lib/notificationLinks';
import { isConversationOpen } from '@/lib/openConversation';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

// Qué aviso mostrar cuando llega algo por Realtime (un mensaje o una
// notificación), como hacen WhatsApp o Instagram:
//   - app abierta y a la vista → aviso interno (components/inAppAlert.tsx);
//   - web con la pestaña oculta → aviso del navegador;
//   - celular en segundo plano → nada acá: lo avisa el push del backend.

const PREVIEW_MAX_LENGTH = 120;

function deliver(alert: {
  key: string;
  icon: 'chats' | 'bell';
  title: string;
  body: string;
  onPress: () => void;
}): void {
  if (isAppInForeground()) {
    showInAppAlert({ id: alert.key, icon: alert.icon, title: alert.title, body: alert.body, onPress: alert.onPress });
  } else if (Platform.OS === 'web') {
    showBrowserNotification({ title: alert.title, body: alert.body, tag: alert.key, onClick: alert.onPress });
  }
}

export function alertNewMessage(message: MessageView, myUserId: string): void {
  if (message.senderId === myUserId) return;
  // La conversación que está en pantalla: el mensaje ya se ve.
  if (isConversationOpen(message.conversationId) && isAppInForeground()) return;

  const conversation = queryClient
    .getQueryData<List<ConversationView>>(queryKeys.conversations)
    ?.items.find((c) => c.id === message.conversationId);
  // Igual que el push: en una solicitud (o una conversación que la app
  // todavía no conoce) no se muestra el texto.
  const accepted = conversation !== undefined && conversation.status !== 'request_received';
  const oneLine = message.body.replace(/\s+/g, ' ').trim();
  const body = accepted
    ? oneLine.length <= PREVIEW_MAX_LENGTH
      ? oneLine
      : `${oneLine.slice(0, PREVIEW_MAX_LENGTH - 1)}…`
    : 'Te mandó una solicitud de mensaje';

  deliver({
    // Varios mensajes de la misma conversación se reemplazan.
    key: `message:${message.conversationId}`,
    icon: 'chats',
    title: conversation ? `u/${conversation.otherUser.username}` : 'Mensaje nuevo',
    body,
    onPress: () =>
      router.push({
        pathname: '/chat/[conversationId]',
        params: { conversationId: message.conversationId },
      }),
  });
}

export function alertNewNotification(notification: NotificationView): void {
  // El mismo texto que la lista y el push.
  const { kicker, text, link } = describeNotification(notification);
  deliver({
    key: `notification:${notification.id}`,
    icon: 'bell',
    title: kicker,
    body: text,
    onPress: () => {
      markNotificationReadById(notification.id);
      openNotificationLink(link, notification.post.id, 'alert');
    },
  });
}
