import type { ConversationView, MessageView } from '@utalk/shared';
import { router, Stack } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockUserSheet } from '@/components/blockUserSheet';
import { BottomSheet, SheetOption } from '@/components/bottomSheet';
import { ChatComposer } from '@/components/chatComposer';
import { Icon } from '@/components/icon';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { markConversationRead, useSendMessage } from '@/hooks/mutations';
import { useConversation, useMessages, useMyProfile } from '@/hooks/queries';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { useTheme } from '@/hooks/useTheme';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { errorMessage } from '@/lib/errorMessages';

// Una conversación: los mensajes (los nuevos llegan por Realtime), "Visto",
// "escribiendo…" y la barra para escribir, que depende de si es una
// solicitud (ver ConversationFooter).
export function ConversationScreen({ conversationId }: { conversationId: string }) {
  const me = useMyProfile();
  const headerHeight = useHeaderHeight();
  const conversation = useConversation(conversationId);
  const messages = useMessages(conversationId);
  const typing = useTypingIndicator(conversationId, me.data?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [blockAfterClose, setBlockAfterClose] = useState(false);
  const openProfile = useOpenProfile();

  // Al abrirla, y cada vez que llega algo nuevo mientras está abierta.
  useEffect(() => {
    if (conversation.data) markConversationRead(conversation.data);
  }, [conversation.data]);

  // Si llegó un mensaje de la otra persona, ya no está escribiendo.
  const newest = messages.data?.[0];
  const { clearOtherTyping } = typing;
  useEffect(() => {
    if (newest && newest.senderId !== me.data?.id) clearOtherTyping();
  }, [newest, me.data?.id, clearOtherTyping]);

  if (conversation.isPending) {
    return (
      <ThemedView style={styles.container}>
        <StateMessage kind="loading" />
      </ThemedView>
    );
  }
  if (conversation.isError) {
    return (
      <ThemedView style={styles.container}>
        <StateMessage
          kind="error"
          message={errorMessage(conversation.error)}
          onRetry={() => void conversation.refetch()}
        />
      </ThemedView>
    );
  }

  const { otherUser } = conversation.data;
  // "Visto" va solo debajo del último mensaje tuyo, si ya lo leyó.
  const lastMine = messages.data?.find((message) => message.senderId === me.data?.id);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: `u/${otherUser.username}`,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Más opciones"
              onPress={() => setMenuOpen(true)}
              hitSlop={8}>
              <Icon name="more" size={22} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}>
        <FlatList<MessageView>
          // Invertida: el más nuevo abajo, y al subir se cargan los anteriores.
          inverted
          data={messages.data ?? []}
          keyExtractor={(message) => message.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isMine={item.senderId === me.data?.id}
              showSeen={item.id === lastMine?.id && item.readAt !== null}
            />
          )}
          ListHeaderComponent={
            typing.isOtherTyping ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.typing}>
                u/{otherUser.username} está escribiendo…
              </ThemedText>
            ) : undefined
          }
          ListEmptyComponent={
            messages.isPending ? (
              <StateMessage kind="loading" />
            ) : messages.isError ? (
              <StateMessage
                kind="error"
                message={errorMessage(messages.error)}
                onRetry={() => void messages.refetch()}
              />
            ) : undefined
          }
          onEndReached={() => {
            if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        />
        <ConversationFooter
          conversation={conversation.data}
          onTyping={typing.notifyTyping}
          onBlock={() => setConfirmingBlock(true)}
        />
      </KeyboardAvoidingView>

      <BottomSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onClosed={() => {
          if (!blockAfterClose) return;
          setBlockAfterClose(false);
          setConfirmingBlock(true);
        }}>
        <SheetOption
          icon="profile"
          label={`Ver perfil de u/${otherUser.username}`}
          onPress={() => {
            setMenuOpen(false);
            openProfile(otherUser.id);
          }}
        />
        <SheetOption
          icon="close"
          label="Bloquear"
          destructive
          onPress={() => {
            setBlockAfterClose(true);
            setMenuOpen(false);
          }}
        />
      </BottomSheet>

      <BlockUserSheet
        visible={confirmingBlock}
        onClose={() => setConfirmingBlock(false)}
        user={otherUser}
        onBlocked={() => router.back()}
      />
    </ThemedView>
  );
}

type ConversationFooterProps = {
  conversation: ConversationView;
  onTyping: () => void;
  onBlock: () => void;
};

// Qué se puede hacer según el estado:
// - solicitud recibida: responder (la acepta) o bloquear.
// - solicitud enviada: esperar; no se puede mandar otro mensaje.
// - aceptada: escribir.
function ConversationFooter({ conversation, onTyping, onBlock }: ConversationFooterProps) {
  const theme = useTheme();
  const send = useSendMessage(conversation.id);
  const username = conversation.otherUser.username;

  if (conversation.status === 'request_sent') {
    return (
      <SafeAreaView edges={['bottom']} style={[styles.notice, { borderTopColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Esperando que u/{username} acepte tu solicitud. Hasta que responda, no puedes mandarle otro
          mensaje.
        </ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <View>
      {conversation.status === 'request_received' && (
        <View style={[styles.request, { borderTopColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small">
            u/{username} quiere hablar contigo. No sabe si leíste su mensaje: si respondes, aceptas la
            solicitud.
          </ThemedText>
          <Pressable accessibilityRole="button" onPress={onBlock} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="warning">
              Bloquear
            </ThemedText>
          </Pressable>
        </View>
      )}
      <ChatComposer
        sending={send.isPending}
        error={send.isError ? errorMessage(send.error) : null}
        onTyping={onTyping}
        onSend={async (body) => {
          try {
            await send.mutateAsync(body);
            return true;
          } catch {
            return false;
          }
        }}
      />
    </View>
  );
}

function MessageBubble({ message, isMine, showSeen }: { message: MessageView; isMine: boolean; showSeen: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.bubbleRow, isMine ? styles.mine : styles.theirs]}>
      <View
        style={[
          styles.bubble,
          isMine ? { backgroundColor: theme.primary } : { backgroundColor: theme.backgroundElement },
        ]}>
        <ThemedText themeColor={isMine ? 'onPrimary' : 'text'}>{message.body}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
        {formatTime(message.createdAt)}
        {showSeen ? ' · Visto' : ''}
      </ThemedText>
    </View>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexGrow: 1,
  },
  typing: {
    marginTop: Spacing.one,
  },
  bubbleRow: {
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
  meta: {
    fontSize: 11,
  },
  notice: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  request: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  center: {
    textAlign: 'center',
  },
});
