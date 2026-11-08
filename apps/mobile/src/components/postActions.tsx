import type { PostView } from '@utalk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet, SheetOption } from '@/components/bottomSheet';
import { ConfirmSheet } from '@/components/confirmSheet';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useDeletePost } from '@/hooks/mutations';
import { useMyProfile } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';

type PostActionsProps = {
  post: PostView;
  // Después de borrarla (ej. el detalle vuelve atrás).
  onDeleted?: () => void;
};

// El "···" de un post: borrarlo si es tuyo, reportarlo si no (y si ya lo
// reportaste, no hay nada que hacer: no aparece).
export function PostActions({ post, onDeleted }: PostActionsProps) {
  const theme = useTheme();
  const me = useMyProfile();
  const deletePost = useDeletePost();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Se navega a reportar recién cuando la hoja terminó de cerrarse.
  const [reportAfterClose, setReportAfterClose] = useState(false);

  const isMine = post.author.id === me.data?.id;
  if (!isMine && post.reportedByMe) return null;

  const comments =
    post.commentCount === 1 ? 'El comentario se va con ella.' : `Los ${post.commentCount} comentarios se van con ella.`;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Más opciones"
        onPress={() => setMenuOpen(true)}
        hitSlop={8}>
        <Icon name="more" size={20} color="textSecondary" />
      </Pressable>

      <BottomSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onClosed={() => {
          if (!reportAfterClose) return;
          setReportAfterClose(false);
          router.push({ pathname: '/report', params: { postId: post.id, author: post.author.username } });
        }}>
        {isMine ? (
          <SheetOption
            icon="trash"
            label="Borrar publicación"
            destructive
            onPress={() => {
              setMenuOpen(false);
              deletePost.reset();
              setConfirming(true);
            }}
          />
        ) : (
          <SheetOption
            icon="flag"
            label="Reportar un problema"
            onPress={() => {
              setReportAfterClose(true);
              setMenuOpen(false);
            }}
          />
        )}
      </BottomSheet>

      <ConfirmSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        title="¿Borrar tu publicación?"
        description="Desaparece para todos. No se puede recuperar ni volver a publicar la misma."
        confirmLabel="Sí, borrarla"
        cancelLabel="Dejarla publicada"
        loading={deletePost.isPending}
        errorMessage={deletePost.isError ? errorMessage(deletePost.error) : null}
        onConfirm={() =>
          deletePost.mutate(post.id, {
            onSuccess: () => {
              setConfirming(false);
              onDeleted?.();
            },
          })
        }>
        {post.commentCount > 0 && (
          <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="comment" size={16} color="textSecondary" />
            <ThemedText type="small" themeColor="textSecondary">
              {comments}
            </ThemedText>
          </View>
        )}
      </ConfirmSheet>
    </>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
    marginBottom: Spacing.two,
  },
});
