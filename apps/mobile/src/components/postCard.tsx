import type { PostView } from '@utalk/shared';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { relativeTime } from '@/lib/relativeTime';

type PostCardProps = {
  post: PostView;
  // Nombre del foro: se muestra en el feed de un panel, donde se mezclan
  // posts de varios foros. En el feed de un foro se omite.
  forumName?: string;
};

export function PostCard({ post, forumName }: PostCardProps) {
  const theme = useTheme();
  const comments = post.commentCount === 1 ? '1 comentario' : `${post.commentCount} comentarios`;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {forumName ? `${forumName} · ` : ''}u/{post.author.username} · {post.author.university.name}
        {' · '}
        {relativeTime(post.createdAt)}
      </ThemedText>

      <ThemedText style={styles.title} numberOfLines={3}>
        {post.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
        {post.body}
      </ThemedText>

      <View style={styles.footer}>
        <ThemedText
          type="smallBold"
          // Si ya votó, el score se resalta (la flecha para votar llega con
          // la rama de interacción).
          style={{ color: post.myVote === null ? theme.textSecondary : theme.primary }}>
          ▲ {post.score}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {comments}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    fontWeight: 700,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
});
