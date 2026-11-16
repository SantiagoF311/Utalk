import type { MessagePage, MessageView } from '@utalk/shared';
import type { InfiniteData } from '@tanstack/react-query';

import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

// Un mismo mensaje puede llegar dos veces: como respuesta de la API (el que
// lo mandó) y por Realtime. Por eso agregar es idempotente por id.
export function addMessageToCache(message: MessageView) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(queryKeys.messages(message.conversationId), (data) => {
    if (!data) return data;
    const exists = data.pages.some((page) => page.items.some((item) => item.id === message.id));
    if (exists) return data;
    // La primera página es la de los más nuevos.
    const [first, ...rest] = data.pages;
    return first ? { ...data, pages: [{ ...first, items: [message, ...first.items] }, ...rest] } : data;
  });
}

// Un cambio en un mensaje que ya está en la caché (el "Visto").
export function updateMessageInCache(message: MessageView) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(queryKeys.messages(message.conversationId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (item.id === message.id ? message : item)),
          })),
        }
      : data,
  );
}

// La lista de chats y el detalle de la conversación (último mensaje, no
// leídos, estado de la solicitud) se vuelven a pedir.
export function refreshConversation(conversationId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
}
