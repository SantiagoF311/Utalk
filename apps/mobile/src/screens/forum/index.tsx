import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { FeedList } from '@/components/feedList';
import { RequireSession } from '@/components/requireSession';
import { ThemedView } from '@/components/themedView';
import { useForum } from '@/hooks/queries';

// Un foro: su feed.
export function ForumScreen({ forumId }: { forumId: string }) {
  const forum = useForum(forumId);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: forum.data?.name ?? '' }} />
      <RequireSession>
        <FeedList scope={{ forumId }} />
      </RequireSession>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
