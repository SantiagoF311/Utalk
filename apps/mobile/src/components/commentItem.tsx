import type { CommentView } from '@utalk/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { relativeTime } from '@/lib/relativeTime';

// A partir de esta profundidad las respuestas ya no se corren más a la
// derecha: en un celular, un hilo muy profundo dejaría el texto sin ancho.
const MAX_INDENTED_DEPTH = 4;

type CommentItemProps = {
  comment: CommentView;
  depth?: number;
};

// Un comentario con sus respuestas, recursivo. Tocar la cabecera colapsa o
// expande el hilo, como en Reddit.
export function CommentItem({ comment, depth = 0 }: CommentItemProps) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const replyCount = countReplies(comment);

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityHint={collapsed ? 'Muestra el hilo' : 'Oculta el hilo'}
        onPress={() => setCollapsed((value) => !value)}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {comment.author
            ? `u/${comment.author.username} · ${comment.author.university.name}`
            : '[eliminado]'}
          {' · '}
          {relativeTime(comment.createdAt)}
          {collapsed && replyCount > 0 ? ` · +${replyCount}` : ''}
        </ThemedText>
      </Pressable>

      {!collapsed && (
        <>
          {comment.isDeleted ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.deleted}>
              Este comentario fue eliminado.
            </ThemedText>
          ) : (
            <ThemedText type="small">{comment.body}</ThemedText>
          )}

          <ThemedText
            type="smallBold"
            style={{ color: comment.myVote === null ? theme.textSecondary : theme.primary }}>
            ▲ {comment.score}
          </ThemedText>

          {comment.replies.length > 0 && (
            <View
              style={[
                styles.replies,
                depth < MAX_INDENTED_DEPTH && [styles.indented, { borderLeftColor: theme.border }],
              ]}>
              {comment.replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
              ))}
            </View>
          )}
        </>
      )}
    </View>
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
  deleted: {
    fontStyle: 'italic',
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
