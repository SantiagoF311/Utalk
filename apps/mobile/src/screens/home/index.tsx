import { Link } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedList } from '@/components/feedList';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { useCommunities, useMyProfile, usePanels } from '@/hooks/queries';
import { errorMessage } from '@/lib/errorMessages';

// Inicio: el feed del panel de la universidad del usuario.
export function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <MyUniversityFeed />
      </SafeAreaView>
    </ThemedView>
  );
}

function MyUniversityFeed() {
  const me = useMyProfile();
  const panels = usePanels();
  const myPanel = panels.data?.find((panel) => panel.universityId === me.data?.universityId);
  const communities = useCommunities(myPanel?.id ?? '');

  const communityNames = useMemo(
    () => new Map(communities.data?.map((community) => [community.id, community.name])),
    [communities.data],
  );

  if (me.isPending || panels.isPending) return <StateMessage kind="loading" />;
  if (me.isError || panels.isError) {
    return (
      <StateMessage
        kind="error"
        message={errorMessage(me.error ?? panels.error)}
        onRetry={() => {
          void me.refetch();
          void panels.refetch();
        }}
      />
    );
  }
  if (!myPanel) {
    return (
      <StateMessage
        kind="empty"
        title="Tu universidad todavía no tiene panel"
        description="Mientras tanto, mira el panel general en Explorar."
      />
    );
  }

  return (
    <FeedList
      scope={{ panelId: myPanel.id }}
      communityNames={communityNames}
      header={
        <View style={styles.heading}>
          <ThemedText type="subtitle" style={styles.title}>
            {myPanel.name}
          </ThemedText>
          <Link href={{ pathname: '/panel/[panelId]', params: { panelId: myPanel.id } }}>
            <ThemedText type="small" themeColor="primary">
              Ver las comunidades del panel
            </ThemedText>
          </Link>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heading: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
});
