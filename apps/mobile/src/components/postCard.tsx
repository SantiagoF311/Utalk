import type { PostView } from '@utalk/shared';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { VoteBar } from '@/components/voteBar';
import { Spacing } from '@/constants/theme';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { useTheme } from '@/hooks/useTheme';
import { relativeTime } from '@/lib/relativeTime';

type PostCardProps = {
  post: PostView;
  // Nombre de la comunidad: se muestra en el feed de un panel, donde se mezclan
  // posts de varias comunidades. En el feed de una comunidad se omite.
  communityName?: string;
  // En el panel general se cruzan todas las universidades: se dice de cuál
  // es el autor.
  showUniversity?: boolean;
  // En el detalle del post se muestra todo el texto, sin tarjeta; en el
  // feed, recortado.
  full?: boolean;
};

export function PostCard({ post, communityName, showUniversity = false, full = false }: PostCardProps) {
  const theme = useTheme();
  const openProfile = useOpenProfile();

  return (
    <View
      style={[
        styles.card,
        !full && [styles.bordered, { borderColor: theme.border, backgroundColor: theme.background }],
      ]}>
      <View style={styles.meta}>
        {communityName && (
          <View style={[styles.chip, { backgroundColor: theme.primarySoft }]}>
            <ThemedText type="smallBold" themeColor="primary" style={styles.chipText} numberOfLines={1}>
              {communityName}
            </ThemedText>
          </View>
        )}
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.metaText}>
          {/* Tocar el apodo abre su perfil (gana sobre el toque de la tarjeta). */}
          <ThemedText
            type="smallBold"
            themeColor="text"
            style={styles.metaText}
            onPress={() => openProfile(post.author.id)}
            accessibilityRole="link">
            u/{post.author.username}
          </ThemedText>
          {showUniversity ? ` · ${post.author.university.name}` : ''} · {relativeTime(post.createdAt)}
        </ThemedText>
      </View>

      <ThemedText style={[styles.title, full && styles.titleFull]} numberOfLines={full ? undefined : 3}>
        {post.title}
      </ThemedText>
      <ThemedText
        type={full ? 'default' : 'small'}
        themeColor={full ? 'text' : 'textSecondary'}
        numberOfLines={full ? undefined : 3}>
        {post.body}
      </ThemedText>

      <View style={styles.footer}>
        <VoteBar score={post.score} myVote={post.myVote} />
        <View style={styles.comments}>
          <Icon name="comment" size={16} color="textSecondary" />
          <ThemedText type="small" themeColor="textSecondary">
            {post.commentCount}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  bordered: {
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    maxWidth: '45%',
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
  },
  metaText: {
    fontSize: 13,
    flexShrink: 1,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 700,
  },
  titleFull: {
    fontSize: 20,
    lineHeight: 26,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    marginTop: Spacing.one,
  },
  comments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
