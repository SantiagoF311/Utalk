import type { SearchResult } from '@utalk/shared';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { relativeTime } from '@/lib/relativeTime';

type SearchResultCardProps = {
  result: SearchResult;
  // En el panel general se dice de qué universidad es el autor.
  showUniversity: boolean;
};

// Un resultado de búsqueda (diseño 6b): publicación o comentario. Los
// comentarios dicen de qué publicación son.
export function SearchResultCard({ result, showUniversity }: SearchResultCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <View style={styles.meta}>
        {result.kind === 'comment' && (
          <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.chipText}>
              Comentario
            </ThemedText>
          </View>
        )}
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.metaText}>
          <ThemedText type="smallBold" themeColor="text" style={styles.metaText}>
            u/{result.author.username}
          </ThemedText>
          {showUniversity ? ` · ${result.author.university.name}` : ''} · {relativeTime(result.createdAt)}
        </ThemedText>
      </View>

      {result.kind === 'post' && (
        <ThemedText numberOfLines={2} style={styles.title}>
          {result.title}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor={result.kind === 'post' ? 'textSecondary' : 'text'} numberOfLines={3}>
        {result.body}
      </ThemedText>

      <View style={styles.footer}>
        <View style={styles.stat}>
          <Icon name="upvote" size={14} color="textSecondary" />
          <ThemedText type="smallBold">{result.score}</ThemedText>
        </View>
        {result.kind === 'post' ? (
          <View style={styles.stat}>
            <Icon name="comment" size={14} color="textSecondary" />
            <ThemedText type="small" themeColor="textSecondary">
              {result.commentCount}
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.postTitle}>
            en «{result.postTitle}»
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  postTitle: {
    flex: 1,
  },
});
