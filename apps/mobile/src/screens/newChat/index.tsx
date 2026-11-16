import { router, Stack } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { ChatComposer } from '@/components/chatComposer';
import { Icon } from '@/components/icon';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { useStartConversation } from '@/hooks/mutations';
import { useConversationWith } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';

type NewChatScreenProps = { userId: string; username: string };

// Escribirle a alguien por primera vez (desde su perfil). Si ya hablaron,
// abre esa conversación. El primer mensaje le llega como solicitud.
export function NewChatScreen({ userId, username }: NewChatScreenProps) {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const existing = useConversationWith(userId);
  const start = useStartConversation();

  const existingId = existing.data?.id;
  useEffect(() => {
    if (existingId) {
      router.replace({ pathname: '/chat/[conversationId]', params: { conversationId: existingId } });
    }
  }, [existingId]);

  if (existing.isPending || existingId) {
    return (
      <ThemedView style={styles.container}>
        <StateMessage kind="loading" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: `u/${username}` }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}>
        <View style={styles.intro}>
          <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="chats" size={28} color="textSecondary" />
          </View>
          <ThemedText type="smallBold" style={styles.center}>
            Tu mensaje le llega como solicitud
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Hasta que u/{username} responda, no puedes mandarle otro. Solo ve tu apodo: sigues siendo
            anónimo.
          </ThemedText>
        </View>
        <ChatComposer
          autoFocus
          placeholder={`Escríbele a u/${username}`}
          sending={start.isPending}
          error={start.isError ? errorMessage(start.error) : null}
          onSend={async (body) => {
            try {
              const { conversation } = await start.mutateAsync({ recipientId: userId, body });
              router.replace({ pathname: '/chat/[conversationId]', params: { conversationId: conversation.id } });
              return true;
            } catch {
              return false;
            }
          }}
        />
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  intro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
