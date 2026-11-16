import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

// Cada cuánto se avisa "estoy escribiendo" mientras se tipea, y cuánto dura
// el aviso del otro si deja de llegar.
const SEND_EVERY_MS = 2_000;
const SHOW_FOR_MS = 4_000;

// "Escribiendo…" con un canal de Broadcast de Realtime por conversación: es
// estado efímero (no se guarda en la base). Solo viaja quién escribe, nunca
// el texto. El nombre del canal es el id de la conversación (un UUID que
// solo conocen sus dos participantes).
export function useTypingIndicator(conversationId: string, myUserId: string | undefined) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  useEffect(() => {
    if (!myUserId) return;

    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if ((payload as { userId?: string }).userId === myUserId) return;
        setIsOtherTyping(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setIsOtherTyping(false), SHOW_FOR_MS);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, myUserId]);

  // Llamar en cada cambio del texto: manda el aviso como mucho cada 2 s.
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (!channelRef.current || !myUserId || now - lastSentRef.current < SEND_EVERY_MS) return;
    lastSentRef.current = now;
    void channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: myUserId } });
  }, [myUserId]);

  // Si llega un mensaje suyo, ya dejó de escribir.
  const clearOtherTyping = useCallback(() => setIsOtherTyping(false), []);

  return { isOtherTyping, notifyTyping, clearOtherTyping };
}
