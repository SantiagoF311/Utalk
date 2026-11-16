import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { ChatMessage } from '@/lib/chatCache';

type MessageBubbleProps = {
  message: ChatMessage;
  isMine: boolean;
  // "Visto" debajo (solo el último propio ya leído).
  showSeen?: boolean;
  onRetry?: () => void;
};

// Si el servidor tarda más que esto en confirmar un mensaje propio, recién
// ahí aparece el relojito. Casi siempre confirma antes (~0,5 s), y verlo
// aparecer y desaparecer en cada mensaje cansa la vista.
const SHOW_PENDING_AFTER_MS = 1_000;

// Un mensaje del chat. Uno propio sin confirmar se ve igual que los demás
// (optimista); si tarda en confirmarse, lleva un relojito junto a la hora,
// como WhatsApp. Los que no se enviaron dicen por qué y se reintentan
// tocándolos.
export function MessageBubble({ message, isMine, showSeen = false, onRetry }: MessageBubbleProps) {
  const theme = useTheme();
  const failed = message.localStatus === 'failed';
  const sending = message.localStatus === 'sending';
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!sending) return;
    const timer = setTimeout(() => setIsSlow(true), SHOW_PENDING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [sending]);

  return (
    <Pressable
      accessibilityRole={failed ? 'button' : undefined}
      accessibilityHint={failed ? 'Vuelve a enviar el mensaje' : undefined}
      disabled={!failed}
      onPress={onRetry}
      style={[styles.row, isMine ? styles.mine : styles.theirs]}>
      <View
        style={[
          styles.bubble,
          isMine ? { backgroundColor: theme.primary } : { backgroundColor: theme.backgroundElement },
          failed && styles.failed,
        ]}>
        <ThemedText themeColor={isMine ? 'onPrimary' : 'text'}>{message.body}</ThemedText>
      </View>
      {failed ? (
        <ThemedText type="small" themeColor="warning" style={[styles.meta, styles.failedText]}>
          No se envió{message.localError ? `: ${message.localError}` : ''} · Toca para reintentar
        </ThemedText>
      ) : (
        <View style={styles.metaRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
            {formatTime(message.createdAt)}
            {showSeen ? ' · Visto' : ''}
          </ThemedText>
          {sending && isSlow && (
            <View accessible accessibilityLabel="Enviando">
              <Icon name="pending" size={11} color="textSecondary" />
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  row: {
    maxWidth: '80%',
    gap: Spacing.half,
  },
  mine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  meta: {
    fontSize: 11,
  },
  failed: {
    opacity: 0.5,
  },
  failedText: {
    textAlign: 'right',
  },
});
