import type { BlockedUser } from '@utalk/shared';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useToggleBlock } from '@/hooks/mutations';
import { useBlocks } from '@/hooks/queries';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';
import { relativeTime } from '@/lib/relativeTime';

// Usuarios bloqueados (desde Ajustes), para desbloquearlos.
export function BlockedUsersScreen() {
  const theme = useTheme();
  const blocks = useBlocks();
  const pullToRefresh = usePullToRefresh(() => blocks.refetch());

  const empty = blocks.isPending ? (
    <StateMessage kind="loading" />
  ) : blocks.isError ? (
    <StateMessage kind="error" message={errorMessage(blocks.error)} onRetry={() => void blocks.refetch()} />
  ) : (
    <StateMessage
      kind="empty"
      title="No bloqueaste a nadie"
      description="Puedes bloquear a alguien desde su perfil o desde una conversación."
    />
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <FlatList<BlockedUser>
          data={blocks.data ?? []}
          keyExtractor={(blocked) => blocked.user.id}
          renderItem={({ item }) => <BlockedRow blocked={item} />}
          ListHeaderComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              No pueden escribirte. No se enteran de que los bloqueaste.
            </ThemedText>
          }
          ListEmptyComponent={empty}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
          refreshControl={
            <RefreshControl
              {...pullToRefresh}
              tintColor={theme.textSecondary}
            />
          }
          contentContainerStyle={styles.content}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function BlockedRow({ blocked }: { blocked: BlockedUser }) {
  const toggleBlock = useToggleBlock();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <ThemedText>u/{blocked.user.username}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {blocked.user.university.name} · bloqueado {relativeTime(blocked.blockedAt)}
        </ThemedText>
        {toggleBlock.isError && (
          <ThemedText type="small" themeColor="warning">
            {errorMessage(toggleBlock.error)}
          </ThemedText>
        )}
      </View>
      <Button
        title="Desbloquear"
        variant="ghost"
        loading={toggleBlock.isPending}
        onPress={() => toggleBlock.mutate({ userId: blocked.user.id, block: false })}
        style={styles.button}
      />
    </View>
  );
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
  hint: {
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  button: {
    height: 40,
    paddingHorizontal: Spacing.three,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
});
