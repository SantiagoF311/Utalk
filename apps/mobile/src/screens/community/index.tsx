import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { FeedList } from '@/components/feedList';
import { ThemedView } from '@/components/themedView';
import { useCommunity } from '@/hooks/queries';

// Una comunidad: su feed.
export function CommunityScreen({ communityId }: { communityId: string }) {
  const community = useCommunity(communityId);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: community.data?.name ?? '' }} />
      <FeedList scope={{ communityId }} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
