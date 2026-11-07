import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedList } from '@/components/feedList';
import { ScreenHeader } from '@/components/screenHeader';
import { StateMessage } from '@/components/stateMessage';
import { ThemedView } from '@/components/themedView';
import { useCommunities } from '@/hooks/queries';
import { useFeedSelection } from '@/hooks/useFeedSelection';
import { errorMessage } from '@/lib/errorMessages';

// Inicio: el feed del panel elegido en el sidebar (por defecto, el de tu
// universidad). Tocar el nombre del panel abre el sidebar para cambiarlo.
export function HomeScreen() {
  const selection = useFeedSelection();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title={selection.panel?.name ?? 'UTalk'} titleOpensSidebar />
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
});
