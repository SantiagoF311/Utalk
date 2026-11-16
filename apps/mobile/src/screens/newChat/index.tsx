import { router, Stack } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { ChatComposer } from '@/components/chatComposer';
import { Icon } from '@/components/icon';
import { MessageBubble } from '@/components/messageBubble';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useStartConversation } from '@/hooks/mutations';
import { useConversationWith, useMyProfile } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { ChatMessage, newLocalMessageId, seedFirstMessage } from '@/lib/chatCache';
import { errorMessage } from '@/lib/errorMessages';

type NewChatScreenProps = { userId: string; username: string };

// Escribirle a alguien por primera vez (desde su perfil). Si ya hablaron,
// abre esa conversación. El primer mensaje le llega como solicitud.
//
// Optimista como el resto del chat: el mensaje aparece al instante como
// "Enviando…" acá mismo. Cuando el servidor crea la conversación, esta
// pantalla se reemplaza por la de la conversación, que ya tiene el mensaje
// en la caché (seedFirstMessage), así que se ve igual. Si falla, queda "No
// se envió" y se reintenta tocándolo.
export function NewChatScreen({ userId, username }: NewChatScreenProps) {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const me = useMyProfile();
  const existing = useConversationWith(userId);
  const start = useStartConversation();
  // El primer mensaje, mientras no se confirmó (o si falló).
  const [pending, setPending] = useState<ChatMessage | null>(null);

  const existingId = existing.data?.id;
  useEffect(() => {
    if (existingId) {
      router.replace({ pathname: '/chat/[conversationId]', params: { conversationId: existingId } });
    }
  }, [existingId]);

  const send = (body: string) => {
    setPending({
      id: newLocalMessageId(),
      conversationId: '',
      senderId: me.data?.id ?? '',
      body,
      readAt: null,
      createdAt: new Date().toISOString(),
      localStatus: 'sending',
    });
    start.mutate(
      { recipientId: userId, body },
      {
        onSuccess: ({ conversation, message }) => {
          seedFirstMessage(message);
          router.replace({ pathname: '/chat/[conversationId]', params: { conversationId: conversation.id } });
        },
        onError: (error) =>
          setPending((current) =>
            current ? { ...current, localStatus: 'failed', localError: errorMessage(error) } : current,
          ),
      },
    );
  };

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
        <View style={styles.body}>
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
          {pending && <MessageBubble message={pending} isMine onRetry={() => send(pending.body)} />}
        </View>
        {/* Mientras se envía no se puede mandar otro (sería el segundo de una
            solicitud). Si falló, se puede escribir otro en su lugar. */}
        {pending?.localStatus !== 'sending' && (
          <ChatComposer
            autoFocus
            placeholder={`Escríbele a u/${username}`}
            sending={false}
            onSend={(body) => {
              send(body);
              return Promise.resolve(true);
            }}
          />
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    gap: Spacing.three,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  intro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
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
