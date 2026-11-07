import type { CommentView } from '@utalk/shared';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { CommentItem } from '@/components/commentItem';
import { PostCard } from '@/components/postCard';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useComments, usePost } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';

// Detalle de un post: el post completo y su árbol de comentarios. Solo
// lectura por ahora (votar y comentar llegan con la rama de interacción).
export function PostScreen({ postId }: { postId: string }) {
  const theme = useTheme();
  const post = usePost(postId);
  const comments = useComments(postId);

  if (post.isPending) {
    return (
      <ThemedView style={styles.container}>
        <StateMessage kind="loading" />
      </ThemedView>
    );
  }
  if (post.isError) {
    return (
      <ThemedView style={styles.container}>
        <StateMessage kind="error" message={errorMessage(post.error)} onRetry={() => void post.refetch()} />
      </ThemedView>
    );
  }

  const commentsState = comments.isPending ? (
    <StateMessage kind="loading" />
  ) : comments.isError ? (
    <StateMessage
      kind="error"
      message={errorMessage(comments.error)}
      onRetry={() => void comments.refetch()}
    />
  ) : (
    <StateMessage
      kind="empty"
      title="Todavía no hay comentarios"
      description="Cuando alguien comente, va a aparecer acá."
    />
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList<CommentView>
        data={comments.data ?? []}
        keyExtractor={(comment) => comment.id}
        renderItem={({ item }) => <CommentItem comment={item} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <PostCard post={post.data} full />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ThemedText type="smallBold">
              {post.data.commentCount === 1 ? '1 comentario' : `${post.data.commentCount} comentarios`}
            </ThemedText>
          </View>
        }
        ListEmptyComponent={commentsState}
        ItemSeparatorComponent={Separator}
        refreshControl={
          <RefreshControl
            refreshing={post.isRefetching || comments.isRefetching}
            onRefresh={() => {
              void post.refetch();
              void comments.refetch();
            }}
            tintColor={theme.textSecondary}
          />
        }
        contentContainerStyle={styles.content}
      />
    </ThemedView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  separator: {
    height: Spacing.four,
  },
});
