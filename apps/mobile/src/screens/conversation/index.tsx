import type { ConversationView } from '@utalk/shared';
import { Stack, useFocusEffect } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockUserSheet } from '@/components/blockUserSheet';
import { BottomSheet, SheetOption } from '@/components/bottomSheet';
import { Button } from '@/components/button';
import { ChatComposer } from '@/components/chatComposer';
import { MessageBubble } from '@/components/messageBubble';
import { Icon } from '@/components/icon';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { markConversationRead, useSendMessage, useToggleBlock } from '@/hooks/mutations';
import { useConversation, useMessages, useMyProfile } from '@/hooks/queries';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { useTheme } from '@/hooks/useTheme';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import type { ChatMessage } from '@/lib/chatCache';
import { errorMessage } from '@/lib/errorMessages';
import { setOpenConversation } from '@/lib/openConversation';

// Una conversación: los mensajes (los nuevos llegan por Realtime), "Visto",
// "escribiendo…" y la barra para escribir, que depende de si es una
// solicitud (ver ConversationFooter).
export function ConversationScreen({ conversationId }: { conversationId: string }) {
  const me = useMyProfile();
  const headerHeight = useHeaderHeight();
  const conversation = useConversation(conversationId);
  const messages = useMessages(conversationId);
  const typing = useTypingIndicator(conversationId, me.data?.id);
  const sendMessage = useSendMessage(conversationId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [blockAfterClose, setBlockAfterClose] = useState(false);
  const toggleBlock = useToggleBlock();
  const openProfile = useOpenProfile();

  // Mientras está en pantalla, sus mensajes nuevos no se avisan (ya se ven).
  useFocusEffect(
    useCallback(() => {
      setOpenConversation(conversationId);
      return () => setOpenConversation(null);
    }, [conversationId]),
  );

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
  // "Visto" va solo debajo del último mensaje tuyo ya confirmado, si lo leyó.
  const lastMine = messages.data?.find(
    (message: ChatMessage) => message.senderId === me.data?.id && !message.localStatus,
  );

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
        <FlatList<ChatMessage>
          // Invertida: el más nuevo abajo, y al subir se cargan los anteriores.
          inverted
          data={messages.data ?? []}
          keyExtractor={(message) => message.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isMine={item.senderId === me.data?.id}
              showSeen={item.id === lastMine?.id && item.readAt !== null}
              onRetry={() => sendMessage.retry(item)}
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
          onSend={sendMessage.send}
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
        {conversation.data.blockedByMe ? (
          <SheetOption
            icon="close"
            label="Desbloquear"
            onPress={() => {
              setMenuOpen(false);
              toggleBlock.mutate({ userId: otherUser.id, block: false });
            }}
          />
        ) : (
          <SheetOption
            icon="close"
            label="Bloquear"
            destructive
            onPress={() => {
              setBlockAfterClose(true);
              setMenuOpen(false);
            }}
          />
        )}
      </BottomSheet>

      {/* Como WhatsApp: al bloquear, la conversación se queda (con el aviso
          y Desbloquear abajo); no se vuelve atrás. */}
      <BlockUserSheet visible={confirmingBlock} onClose={() => setConfirmingBlock(false)} user={otherUser} />
    </ThemedView>
  );
}

type ConversationFooterProps = {
  conversation: ConversationView;
  onSend: (body: string) => void;
  onTyping: () => void;
  onBlock: () => void;
};

// Qué se puede hacer según el estado:
// - la bloqueaste: el aviso y Desbloquear (nadie puede escribir). Si se
//   bloquearon los dos, gana este: es lo que uno puede deshacer.
// - te bloqueó: solo el aviso, sin campo para escribir.
// - solicitud recibida: responder (la acepta) o bloquear.
// - solicitud enviada: esperar; no se puede mandar otro mensaje.
// - aceptada: escribir.
function ConversationFooter({ conversation, onSend, onTyping, onBlock }: ConversationFooterProps) {
  const theme = useTheme();
  const toggleBlock = useToggleBlock();
  const username = conversation.otherUser.username;

  if (conversation.blockedByMe) {
    return (
      <SafeAreaView edges={['bottom']} style={[styles.notice, styles.blocked, { borderTopColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Bloqueaste a u/{username}. No puede escribirte, y tú tampoco a u/{username} hasta que lo
          desbloquees.
        </ThemedText>
        {toggleBlock.isError && (
          <ThemedText type="small" themeColor="warning" style={styles.center}>
            {errorMessage(toggleBlock.error)}
          </ThemedText>
        )}
        <Button
          title="Desbloquear"
          variant="ghost"
          loading={toggleBlock.isPending}
          onPress={() => toggleBlock.mutate({ userId: conversation.otherUser.id, block: false })}
        />
      </SafeAreaView>
    );
  }

  // Te bloqueó: no hay campo para escribir, solo el aviso (como Reddit).
  if (conversation.blockedByOther) {
    return (
      <SafeAreaView edges={['bottom']} style={[styles.notice, { borderTopColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          u/{username} te bloqueó. No puedes escribirle.
        </ThemedText>
      </SafeAreaView>
    );
  }

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
      {/* Optimista: el campo se vacía al instante y el mensaje aparece como
          "Enviando…"; si falla, el error va en la burbuja. */}
      <ChatComposer
        sending={false}
        onTyping={onTyping}
        onSend={(body) => {
          onSend(body);
          return Promise.resolve(true);
        }}
      />
    </View>
  );
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
  notice: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  blocked: {
    gap: Spacing.two,
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
