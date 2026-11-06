import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { FeedList } from '@/components/feedList';
import { ThemedView } from '@/components/themedView';
import { useForum } from '@/hooks/queries';

// Un foro: su feed.
export function ForumScreen({ forumId }: { forumId: string }) {
  const forum = useForum(forumId);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: forum.data?.name ?? '' }} />
      <FeedList scope={{ forumId }} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
