import { Link } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedList } from '@/components/feedList';
import { RequireSession } from '@/components/requireSession';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { useForums, useMyProfile, usePanels } from '@/hooks/queries';
import { errorMessage } from '@/lib/errorMessages';

// Inicio: el feed del panel de la universidad del usuario.
export function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <RequireSession>
          <MyUniversityFeed />
        </RequireSession>
      </SafeAreaView>
    </ThemedView>
  );
}

function MyUniversityFeed() {
  const me = useMyProfile();
  const panels = usePanels();
  const myPanel = panels.data?.find((panel) => panel.universityId === me.data?.universityId);
  const forums = useForums(myPanel?.id ?? '');

  const forumNames = useMemo(
    () => new Map(forums.data?.map((forum) => [forum.id, forum.name])),
    [forums.data],
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
      forumNames={forumNames}
      header={
        <View style={styles.heading}>
          <ThemedText type="subtitle" style={styles.title}>
            {myPanel.name}
          </ThemedText>
          <Link href={{ pathname: '/panel/[panelId]', params: { panelId: myPanel.id } }}>
            <ThemedText type="small" themeColor="primary">
              Ver los foros del panel
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
