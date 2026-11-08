import type { CommentView } from '@utalk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet, SheetOption } from '@/components/bottomSheet';
import { ConfirmSheet } from '@/components/confirmSheet';
import { HiddenNotice, ReportedBanner } from '@/components/hiddenNotice';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { VoteBar } from '@/components/voteBar';
import { Spacing } from '@/constants/theme';
import { nextVote, useDeleteComment, useVoteComment } from '@/hooks/mutations';
import { useMyProfile } from '@/hooks/queries';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { useRevealedReport } from '@/hooks/useRevealedReport';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';
import { relativeTime } from '@/lib/relativeTime';

// A partir de esta profundidad las respuestas ya no se corren más a la
// derecha: en un celular, un hilo muy profundo dejaría el texto sin ancho.
const MAX_INDENTED_DEPTH = 4;

type CommentItemProps = {
  comment: CommentView;
  // "Responder": la pantalla del post abre su barra de comentar apuntando a
  // este comentario.
  onReply: (comment: CommentView) => void;
  depth?: number;
};

// Un comentario con sus respuestas, recursivo. Tocar la cabecera colapsa o
// expande el hilo, como en Reddit.
export function CommentItem({ comment, onReply, depth = 0 }: CommentItemProps) {
  const theme = useTheme();
  const openProfile = useOpenProfile();
  const voteComment = useVoteComment();
  const [collapsed, setCollapsed] = useState(false);
  const [revealed, setRevealed] = useRevealedReport(comment.id);
  const replyCount = countReplies(comment);
  const author = comment.author;
  const hidden = comment.reportedByMe && !revealed;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityHint={collapsed ? 'Muestra el hilo' : 'Oculta el hilo'}
        onPress={() => setCollapsed((value) => !value)}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.meta}>
          <ThemedText
            type="smallBold"
            themeColor={comment.author ? 'text' : 'textSecondary'}
            style={styles.meta}
            // Tocar el apodo abre su perfil; el resto de la cabecera colapsa.
            onPress={author ? () => openProfile(author.id) : undefined}>
            {comment.author ? `u/${comment.author.username}` : '[eliminado]'}
          </ThemedText>
          {comment.author ? ` · ${comment.author.university.name}` : ''}
          {' · '}
          {relativeTime(comment.createdAt)}
          {collapsed && replyCount > 0 ? ` · +${replyCount}` : ''}
        </ThemedText>
      </Pressable>

      {!collapsed && (
        <>
          {/* Lo reportaste: oculto para ti (sus respuestas se siguen viendo).
              Si elegiste verlo, la franja permite volver a ocultarlo. */}
          {comment.reportedByMe && revealed && (
            <ReportedBanner label="Reportaste este comentario" onHide={() => setRevealed(false)} />
          )}
          {hidden ? (
            <HiddenNotice
              title="Comentario oculto"
              description="Lo reportaste. Un moderador lo va a revisar."
              onReveal={() => setRevealed(true)}
              bordered={false}
            />
          ) : comment.isDeleted ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.deleted}>
              Este comentario fue eliminado.
            </ThemedText>
          ) : (
            <ThemedText type="small" style={styles.body}>
              {comment.body}
            </ThemedText>
          )}

          {!hidden && (
          <View style={styles.footer}>
            <VoteBar
              score={comment.score}
              myVote={comment.myVote}
              bordered={false}
              onVote={(pressed) =>
                voteComment.mutate({
                  postId: comment.postId,
                  commentId: comment.id,
                  from: comment.myVote,
                  to: nextVote(comment.myVote, pressed),
                })
              }
            />
            {/* A un comentario borrado no se le puede responder (el backend lo rechaza). */}
            {!comment.isDeleted && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Responder a ${author ? `u/${author.username}` : 'este comentario'}`}
                onPress={() => onReply(comment)}
                hitSlop={8}
                style={styles.reply}>
                <Icon name="reply" size={16} color="textSecondary" />
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Responder
                </ThemedText>
              </Pressable>
            )}
            <View style={styles.actions}>
              <CommentActions comment={comment} />
            </View>
          </View>
          )}

          {comment.replies.length > 0 && (
            <View
              style={[
                styles.replies,
                depth < MAX_INDENTED_DEPTH && [styles.indented, { borderLeftColor: theme.border }],
              ]}>
              {comment.replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} onReply={onReply} depth={depth + 1} />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

// El "···" de un comentario: borrarlo si es tuyo, reportarlo si no (salvo que
// ya lo hayas reportado). Un comentario borrado no tiene opciones.
function CommentActions({ comment }: { comment: CommentView }) {
  const me = useMyProfile();
  const deleteComment = useDeleteComment(comment.postId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Se navega a reportar recién cuando la hoja terminó de cerrarse.
  const [reportAfterClose, setReportAfterClose] = useState(false);

  const isMine = comment.author?.id === me.data?.id;
  if (comment.isDeleted || (!isMine && comment.reportedByMe)) return null;

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Más opciones" onPress={() => setMenuOpen(true)} hitSlop={8}>
        <Icon name="more" size={18} color="textSecondary" />
      </Pressable>

      <BottomSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onClosed={() => {
          if (!reportAfterClose) return;
          setReportAfterClose(false);
          router.push({
            pathname: '/report',
            params: { postId: comment.postId, commentId: comment.id, author: comment.author?.username },
          });
        }}>
        {isMine ? (
          <SheetOption
            icon="trash"
            label="Borrar comentario"
            destructive
            onPress={() => {
              setMenuOpen(false);
              deleteComment.reset();
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
        title="¿Borrar tu comentario?"
        description={
          comment.replies.length > 0
            ? 'Se va a ver como "[eliminado]". Las respuestas que tiene se quedan.'
            : 'Se va a ver como "[eliminado]". No se puede recuperar.'
        }
        confirmLabel="Sí, borrarlo"
        cancelLabel="Dejarlo"
        loading={deleteComment.isPending}
        errorMessage={deleteComment.isError ? errorMessage(deleteComment.error) : null}
        onConfirm={() => deleteComment.mutate(comment.id, { onSuccess: () => setConfirming(false) })}
      />
    </>
  );
}

function countReplies(comment: CommentView): number {
  return comment.replies.reduce((total, reply) => total + 1 + countReplies(reply), 0);
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  meta: {
    fontSize: 13,
  },
  deleted: {
    fontStyle: 'italic',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    marginTop: Spacing.one,
  },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  actions: {
    marginLeft: 'auto',
  },
  replies: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  indented: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
  },
});
