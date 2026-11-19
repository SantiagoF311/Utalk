import type { MessageView } from '@utalk/shared';
import { useEffect } from 'react';

import { useSession } from '@/hooks/useSession';
import { notifyNewMessageInBrowser } from '@/lib/browserNotifications';
import { addMessageToCache, refreshConversation, updateMessageInCache } from '@/lib/chatCache';
import { supabase } from '@/lib/supabase';

// Fila de `messages` tal como la manda Realtime (snake_case).
interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

function toMessageView(row: MessageRow): MessageView {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

// Única suscripción a Realtime del chat, mientras hay sesión. No se filtra
// por conversación: las políticas RLS de `messages` y `conversations` hacen
// que Supabase solo le mande a cada uno lo de sus propias conversaciones
// (ver la migración `chat`). Escribir nunca va por acá, siempre por la API.
export function useChatRealtime() {
  const session = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`chat:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const message = toMessageView(payload.new as MessageRow);
        addMessageToCache(message);
        refreshConversation(message.conversationId);
        // Solo en la web y con la pestaña oculta.
        notifyNewMessageInBrowser(message, userId);
      })
      // El "Visto": read_at cambia cuando el otro abre la conversación.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        updateMessageInCache(toMessageView(payload.new as MessageRow));
      })
      // Una solicitud aceptada (accepted_at) cambia el estado de la conversación.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
        refreshConversation((payload.new as { id: string }).id);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
