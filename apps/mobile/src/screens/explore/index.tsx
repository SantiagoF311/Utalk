import type { Panel } from '@utalk/shared';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useMyProfile, usePanels } from '@/hooks/queries';
import { errorMessage } from '@/lib/errorMessages';

const GENERAL_SLUG = 'general';

// Explorar: todos los paneles. Primero el general y el de tu universidad
// (donde puedes publicar); después el resto, que puedes leer, comentar y votar.
export function ExploreScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <PanelList />
      </SafeAreaView>
    </ThemedView>
  );
}

function sortPanels(panels: Panel[], myUniversityId: string | undefined): Panel[] {
  const rank = (panel: Panel) =>
    panel.slug === GENERAL_SLUG ? 0 : panel.universityId === myUniversityId ? 1 : 2;
  return [...panels].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

function PanelList() {
  const me = useMyProfile();
  const panels = usePanels();

  if (panels.isPending) return <StateMessage kind="loading" />;
  if (panels.isError) {
    return (
      <StateMessage kind="error" message={errorMessage(panels.error)} onRetry={() => void panels.refetch()} />
    );
  }

  return (
    <FlatList
      data={sortPanels(panels.data, me.data?.universityId)}
      keyExtractor={(panel) => panel.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <ThemedText type="subtitle" style={styles.title}>
          Paneles
        </ThemedText>
      }
      ListEmptyComponent={<StateMessage kind="empty" title="Todavía no hay paneles" />}
      ItemSeparatorComponent={Separator}
      renderItem={({ item }) => {
        const isMine = item.universityId !== null && item.universityId === me.data?.universityId;
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/panel/[panelId]', params: { panelId: item.id } })}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.row}>
              <ThemedText style={styles.name}>{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.slug === GENERAL_SLUG
                  ? 'Todas las universidades'
                  : isMine
                    ? 'Tu universidad'
                    : 'Puedes leer, comentar y votar'}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      }}
    />
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
  title: {
    fontSize: 26,
    lineHeight: 32,
    marginBottom: Spacing.three,
  },
  row: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  name: {
    fontWeight: 700,
  },
  separator: {
    height: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
