import type { CommentView } from '@utalk/shared';
import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, View } from 'react-native';

import { CommentComposer } from '@/components/commentComposer';
import { CommentItem } from '@/components/commentItem';
import { PostCard } from '@/components/postCard';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useComments, usePost } from '@/hooks/queries';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';

// Detalle de un post: el post completo, su árbol de comentarios y la barra
// para comentar o responder.
export function PostScreen({ postId }: { postId: string }) {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const post = usePost(postId);
  const comments = useComments(postId);
  const [replyingTo, setReplyingTo] = useState<CommentView | null>(null);
  const pullToRefresh = usePullToRefresh(() => Promise.all([post.refetch(), comments.refetch()]));

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
      description="Sé quien abra la conversación."
    />
  );

  return (
    <ThemedView style={styles.container}>
      {/* La barra de comentar sube con el teclado; en iOS hay que descontar
          la cabecera de navegación. */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}>
        <FlatList<CommentView>
          data={comments.data ?? []}
          keyExtractor={(comment) => comment.id}
          renderItem={({ item }) => <CommentItem comment={item} onReply={setReplyingTo} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <PostCard post={post.data} full onDeleted={() => router.back()} />
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <ThemedText type="smallBold">
                {post.data.commentCount === 1 ? '1 comentario' : `${post.data.commentCount} comentarios`}
              </ThemedText>
            </View>
          }
          ListEmptyComponent={commentsState}
          ItemSeparatorComponent={Separator}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              {...pullToRefresh}
              tintColor={theme.textSecondary}
            />
          }
          contentContainerStyle={styles.content}
        />
        <CommentComposer postId={postId} replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} />
      </KeyboardAvoidingView>
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
