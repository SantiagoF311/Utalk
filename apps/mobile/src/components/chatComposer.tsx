import { MESSAGE_MAX_LENGTH } from '@utalk/shared';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Callout } from '@/components/callout';
import { Icon } from '@/components/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type ChatComposerProps = {
  // Devuelve si se mandó: recién entonces se vacía el campo.
  onSend: (body: string) => Promise<boolean>;
  sending: boolean;
  // Mensaje de error del último envío, si falló.
  error?: string | null;
  // Cada vez que cambia el texto ("escribiendo…").
  onTyping?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
};

// Barra de abajo de una conversación: escribir y mandar.
export function ChatComposer({ onSend, sending, error, onTyping, placeholder, autoFocus }: ChatComposerProps) {
  const theme = useTheme();
  const [body, setBody] = useState('');
  const canSend = body.trim().length > 0 && !sending;

  const send = async () => {
    if (!canSend) return;
    if (await onSend(body.trim())) setBody('');
  };

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.container, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
      {error && <Callout variant="warning">{error}</Callout>}
      <View style={styles.row}>
        <TextInput
          value={body}
          onChangeText={(text) => {
            setBody(text);
            onTyping?.();
          }}
          placeholder={placeholder ?? 'Escribe un mensaje'}
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={MESSAGE_MAX_LENGTH}
          autoFocus={autoFocus}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          disabled={!canSend}
          onPress={() => void send()}
          hitSlop={8}
          style={[styles.send, { backgroundColor: canSend ? theme.primary : theme.backgroundElement }]}>
          {sending ? (
            <ActivityIndicator color={theme.onPrimary} size="small" />
          ) : (
            <Icon name="send" size={18} color={canSend ? 'onPrimary' : 'textSecondary'} />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
