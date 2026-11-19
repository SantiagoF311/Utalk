import type { ConversationView, List, MessageView } from '@utalk/shared';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

// En la web no hay push con la pestaña cerrada (ver docs/chat-realtime.md),
// pero sí un aviso del navegador cuando llega un mensaje y la pestaña no está
// a la vista. El mensaje llega por Realtime (hooks/useChatRealtime.ts).

const PREVIEW_MAX_LENGTH = 120;

function isSupported(): boolean {
  return Platform.OS === 'web' && typeof Notification !== 'undefined';
}

export function requestBrowserNotificationPermission(): void {
  if (isSupported() && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

export function notifyNewMessageInBrowser(message: MessageView, myUserId: string): void {
  if (!isSupported() || Notification.permission !== 'granted') return;
  if (message.senderId === myUserId || !document.hidden) return;

  const conversation = queryClient
    .getQueryData<List<ConversationView>>(queryKeys.conversations)
    ?.items.find((c) => c.id === message.conversationId);
  // Igual que el push del celular: en una solicitud (o una conversación que
  // la app todavía no conoce) no se muestra el texto.
  const accepted = conversation !== undefined && conversation.status !== 'request_received';
  const oneLine = message.body.replace(/\s+/g, ' ').trim();
  const body = accepted
    ? oneLine.length <= PREVIEW_MAX_LENGTH
      ? oneLine
      : `${oneLine.slice(0, PREVIEW_MAX_LENGTH - 1)}…`
    : 'Te mandó una solicitud de mensaje';

  const notification = new Notification(
    conversation ? `u/${conversation.otherUser.username}` : 'Mensaje nuevo',
    // `tag`: varios mensajes de la misma conversación se reemplazan en vez de apilarse.
    { body, tag: message.conversationId },
  );
  notification.onclick = () => {
    window.focus();
    router.push({ pathname: '/chat/[conversationId]', params: { conversationId: message.conversationId } });
    notification.close();
  };
}
