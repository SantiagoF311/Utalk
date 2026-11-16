import type { MessagePage, MessageView } from '@utalk/shared';
import type { InfiniteData } from '@tanstack/react-query';

import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

// Un mensaje en la caché del mobile. Los que uno manda aparecen al instante
// (optimista) con un id provisional y `localStatus`, hasta que el servidor
// los confirma y se reemplazan por el mensaje real.
export type ChatMessage = MessageView & {
  localStatus?: 'sending' | 'failed';
  // Por qué no se envió (texto para el usuario).
  localError?: string;
};

type Pages = MessagePage[];

function updatePages(conversationId: string, update: (pages: Pages) => Pages) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(queryKeys.messages(conversationId), (data) =>
    data ? { ...data, pages: update(data.pages) } : data,
  );
}

function allMessages(pages: Pages): ChatMessage[] {
  return pages.flatMap((page) => page.items);
}

// La primera página es la de los más nuevos.
function prepend(pages: Pages, message: ChatMessage): Pages {
  const [first, ...rest] = pages;
  return first ? [{ ...first, items: [message, ...first.items] }, ...rest] : pages;
}

function replace(pages: Pages, id: string, message: ChatMessage): Pages {
  return pages.map((page) => ({
    ...page,
    items: page.items.map((item) => (item.id === id ? message : item)),
  }));
}

function remove(pages: Pages, id: string): Pages {
  return pages.map((page) => ({ ...page, items: page.items.filter((item) => item.id !== id) }));
}

// Id provisional de un mensaje que todavía no confirmó el servidor.
export function newLocalMessageId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Una conversación recién creada con su primer mensaje: la pantalla de la
// conversación lo muestra al abrirse, sin esperar a pedir el historial (que
// igual se pide al montar y lo completa si había más).
export function seedFirstMessage(message: MessageView) {
  const key = queryKeys.messages(message.conversationId);
  if (queryClient.getQueryData(key)) return;
  queryClient.setQueryData<InfiniteData<MessagePage, string | undefined>>(key, {
    pages: [{ items: [message], nextCursor: null }],
    pageParams: [undefined],
  });
}

// El mensaje que uno acaba de mandar, antes de la respuesta del servidor.
export function addPendingMessage(message: ChatMessage) {
  updatePages(message.conversationId, (pages) => prepend(pages, message));
}

// Llegó un mensaje (por Realtime). Puede ser:
// - uno que ya está (lo confirmó la respuesta de la API): nada que hacer;
// - el confirmado de uno propio que todavía figura "enviando" (Realtime
//   llegó antes que la respuesta de la API): reemplaza a ese, el más viejo
//   con el mismo texto;
// - uno nuevo (del otro, o propio mandado desde otro dispositivo).
export function addMessageToCache(message: MessageView) {
  updatePages(message.conversationId, (pages) => {
    const messages = allMessages(pages);
    if (messages.some((item) => item.id === message.id)) return pages;

    const pending = [...messages]
      .reverse()
      .find(
        (item) =>
          item.localStatus === 'sending' && item.senderId === message.senderId && item.body === message.body,
      );
    return pending ? replace(pages, pending.id, message) : prepend(pages, message);
  });
}

// Respuesta de la API para un mensaje enviado. Si Realtime ya lo había
// reemplazado, solo queda sacar el provisional (si sigue ahí).
export function confirmPendingMessage(localId: string, message: MessageView) {
  updatePages(message.conversationId, (pages) => {
    const messages = allMessages(pages);
    const hasLocal = messages.some((item) => item.id === localId);
    const hasReal = messages.some((item) => item.id === message.id);
    if (hasLocal && hasReal) return remove(pages, localId);
    if (hasLocal) return replace(pages, localId, message);
    return hasReal ? pages : prepend(pages, message);
  });
}

export function failPendingMessage(conversationId: string, localId: string, error: string) {
  updatePages(conversationId, (pages) =>
    pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.id === localId ? { ...item, localStatus: 'failed' as const, localError: error } : item,
      ),
    })),
  );
}

export function removeMessageFromCache(conversationId: string, id: string) {
  updatePages(conversationId, (pages) => remove(pages, id));
}

// Un cambio en un mensaje que ya está en la caché (el "Visto").
export function updateMessageInCache(message: MessageView) {
  updatePages(message.conversationId, (pages) => replace(pages, message.id, message));
}

// La lista de chats y el detalle de la conversación (último mensaje, no
// leídos, estado de la solicitud) se vuelven a pedir.
export function refreshConversation(conversationId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
}
