import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedList } from '@/components/feedList';
import { Icon } from '@/components/icon';
import { ScreenHeader } from '@/components/screenHeader';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { useCommunities } from '@/hooks/queries';
import { useFeedSelection } from '@/hooks/useFeedSelection';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';

// Inicio: el feed del panel elegido en el sidebar (por defecto, el de tu
// universidad), con la barra de búsqueda arriba.
export function HomeScreen() {
  const theme = useTheme();
  const selection = useFeedSelection();
  const panelLabel = !selection.panel
    ? 'UTalk'
    : selection.panel.universityId === null
      ? 'General'
      : selection.panel.name;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Como Reddit: la búsqueda es una barra siempre visible arriba, que
            dice además en qué panel estás. */}
        <ScreenHeader
          center={
            <Pressable
              accessibilityRole="search"
              accessibilityLabel={`Buscar en ${panelLabel}`}
              onPress={() => router.push({ pathname: '/search', params: { panelId: selection.panel?.id } })}
              style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="search" size={18} color="textSecondary" />
              <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.searchText}>
                Buscar en {panelLabel}
              </ThemedText>
            </Pressable>
          }
        />
        <PanelFeed />
      </SafeAreaView>
    </ThemedView>
  );
}

function PanelFeed() {
  const { panel, sort, status, error, retry } = useFeedSelection();
  const communities = useCommunities(panel?.id ?? '');

  const communityNames = useMemo(
    () => new Map(communities.data?.map((community) => [community.id, community.name])),
    [communities.data],
  );

  if (status === 'pending') return <StateMessage kind="loading" />;
  if (status === 'error') return <StateMessage kind="error" message={errorMessage(error)} onRetry={retry} />;
  if (!panel) {
    return (
      <StateMessage
        kind="empty"
        title="Todavía no hay paneles"
        description="Cuando se abra el de tu universidad, va a aparecer acá."
      />
    );
  }

  return (
    <FeedList
      // Al cambiar de panel, la lista se monta de nuevo y vuelve arriba.
      key={panel.id}
      scope={{ panelId: panel.id }}
      communityNames={communityNames}
      showUniversity={panel.universityId === null}
      sort={sort}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  searchText: {
    flex: 1,
  },
});
