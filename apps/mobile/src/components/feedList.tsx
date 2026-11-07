import type { PostSort, PostView } from '@utalk/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { PostCard } from '@/components/postCard';
import { StateMessage } from '@/components/stateMessage';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFeed } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';
import { queryKeys } from '@/lib/queryKeys';

type FeedListProps = {
  scope: { communityId: string } | { panelId: string };
  // Lo que va arriba de los posts (ej. la cabecera de la comunidad y su orden).
  header?: ReactElement;
  // communityId → nombre, para mostrar la comunidad de cada post en el feed de un panel.
  communityNames?: Map<string, string>;
  // En el panel general: mostrar la universidad del autor de cada post.
  showUniversity?: boolean;
  // El orden lo elige quien usa la lista: en Inicio, el sidebar (Popular /
  // Reciente); en una comunidad, su menú de orden.
  sort: PostSort;
};

// Feed paginado por cursor con scroll infinito: al acercarse al final pide la
// página siguiente. Tirar hacia abajo lo refresca.
export function FeedList({
  scope,
  header,
  communityNames,
  showUniversity,
  sort,
}: FeedListProps) {
  const theme = useTheme();
  const feed = useFeed(scope, sort);
  const queryClient = useQueryClient();

  // El post del feed ya está completo: se guarda en la caché del detalle para
  // que se abra al instante, sin pantalla de carga (los comentarios se piden).
  const openPost = (post: PostView) => {
    queryClient.setQueryData(queryKeys.post(post.id), post);
    router.push({ pathname: '/post/[postId]', params: { postId: post.id } });
  };

  const emptyState = feed.isPending ? (
    <StateMessage kind="loading" />
  ) : feed.isError ? (
    <StateMessage kind="error" message={errorMessage(feed.error)} onRetry={() => void feed.refetch()} />
  ) : (
    <StateMessage
      kind="empty"
      title="Todavía no hay publicaciones"
      description="Cuando alguien publique algo, va a aparecer acá."
    />
  );

  return (
    <FlatList<PostView>
      data={feed.data ?? []}
      keyExtractor={(post) => post.id}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.title}
          onPress={() => openPost(item)}
          style={({ pressed }) => pressed && styles.pressed}>
          <PostCard
            post={item}
            communityName={communityNames?.get(item.communityId)}
            showUniversity={showUniversity}
          />
        </Pressable>
      )}
      ListHeaderComponent={header ? <View style={styles.header}>{header}</View> : undefined}
      ListEmptyComponent={emptyState}
      ListFooterComponent={
        feed.isFetchingNextPage ? (
          <ActivityIndicator color={theme.textSecondary} style={styles.footer} />
        ) : undefined
      }
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => void feed.refetch()}
          tintColor={theme.textSecondary}
        />
      }
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.content}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
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
  pressed: {
    opacity: 0.7,
  },
  separator: {
    height: Spacing.three,
  },
  footer: {
    marginVertical: Spacing.four,
  },
});
