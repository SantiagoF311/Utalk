import type { CommentView } from '@utalk/shared';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useCreateComment } from '@/hooks/mutations';
import { useMyProfile } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';

const MAX_LENGTH = 2000;

type CommentComposerProps = {
  postId: string;
  // Comentario al que se responde; null = comentario al post.
  replyingTo: CommentView | null;
  onCancelReply: () => void;
};

// Barra de abajo del detalle del post: "Comenta como u/apodo" y enviar (2c).
// Si se tocó "Responder" en un comentario, dice a quién se responde.
export function CommentComposer({ postId, replyingTo, onCancelReply }: CommentComposerProps) {
  const theme = useTheme();
  const me = useMyProfile();
  const createComment = useCreateComment(postId);
  const inputRef = useRef<TextInputInstance>(null);
  const [body, setBody] = useState('');
  const canSend = body.trim().length > 0 && !createComment.isPending;

  const send = () => {
    if (!canSend) return;
    createComment.mutate(
      { parentId: replyingTo?.id ?? null, body: body.trim() },
      {
        onSuccess: () => {
          setBody('');
          onCancelReply();
          inputRef.current?.blur();
        },
      },
    );
  };

  const replyName = replyingTo?.author ? `u/${replyingTo.author.username}` : 'este comentario';

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
      {replyingTo && (
        <View style={styles.replyRow}>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
            Respondiendo a {replyName}
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar respuesta" onPress={onCancelReply} hitSlop={8}>
            <Icon name="close" size={16} color="textSecondary" />
          </Pressable>
        </View>
      )}
      {createComment.isError && (
        <ThemedText type="small" themeColor="warning">
          {errorMessage(createComment.error)}
        </ThemedText>
      )}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          value={body}
          onChangeText={(text) => {
            setBody(text);
            if (createComment.isError) createComment.reset();
          }}
          placeholder={
            replyingTo ? `Responde a ${replyName}` : me.data ? `Comenta como u/${me.data.username}` : 'Comenta'
          }
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={MAX_LENGTH}
          // Al tocar "Responder" el teclado se abre solo.
          autoFocus={replyingTo !== null}
          key={replyingTo?.id ?? 'post'}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar comentario"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={send}
          style={[styles.send, { backgroundColor: theme.primary }, !canSend && styles.disabled]}>
          {createComment.isPending ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <Icon name="send" size={18} color="onPrimary" />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two + Spacing.half,
    paddingBottom: Spacing.two + Spacing.half,
    fontSize: 15,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
