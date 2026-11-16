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

import { PostCard, PostCommunity } from '@/components/postCard';
import { StateMessage } from '@/components/stateMessage';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFeed } from '@/hooks/queries';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/useTheme';
import type { FeedScope } from '@/lib/api';
import { errorMessage } from '@/lib/errorMessages';
import { queryKeys } from '@/lib/queryKeys';

type FeedListProps = {
  scope: FeedScope;
  // Lo que va arriba de los posts (ej. la cabecera de la comunidad y su orden).
  header?: ReactElement;
  // communityId → comunidad, para mostrar de cuál es cada post en el feed de
  // un panel.
  communities?: Map<string, PostCommunity>;
  // El orden lo elige quien usa la lista: en Inicio, el sidebar (Popular /
  // Reciente); en una comunidad, su menú de orden.
  sort: PostSort;
  // Texto si no hay publicaciones (ej. en un perfil).
  empty?: { title: string; description?: string };
  // Algo más para refrescar al tirar hacia abajo, además del feed (ej. la
  // cabecera de un perfil con sus contadores). Si devuelve una promesa, el
  // spinner espera también a esa.
  onRefresh?: () => unknown;
};

// Feed paginado por cursor con scroll infinito: al acercarse al final pide la
// página siguiente. Tirar hacia abajo lo refresca.
export function FeedList({ scope, header, communities, sort, empty, onRefresh }: FeedListProps) {
  const theme = useTheme();
  const feed = useFeed(scope, sort);
  const queryClient = useQueryClient();
  const pullToRefresh = usePullToRefresh(() => Promise.all([feed.refetch(), onRefresh?.()]));

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
      title={empty?.title ?? 'Todavía no hay publicaciones'}
      description={empty?.description ?? 'Cuando alguien publique algo, va a aparecer acá.'}
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
            community={communities?.get(item.communityId)}
            // En un perfil se mezclan comunidades de varios paneles.
            lookupCommunity={'authorId' in scope}
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
          {...pullToRefresh}
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
