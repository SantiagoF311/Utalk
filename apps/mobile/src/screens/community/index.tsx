import type { PostSort } from '@utalk/shared';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CommunityAvatar } from '@/components/communityAvatar';
import { FeedList } from '@/components/feedList';
import { SortMenu } from '@/components/sortMenu';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { useCommunity } from '@/hooks/queries';
import { recordCommunityVisit } from '@/hooks/useRecentCommunities';

// Una comunidad: su feed. Abrirla la anota en "Visitadas recientemente".
export function CommunityScreen({ communityId }: { communityId: string }) {
  const community = useCommunity(communityId);
  const [sort, setSort] = useState<PostSort>('hot');

  useEffect(() => {
    if (community.data) void recordCommunityVisit(community.data);
  }, [community.data]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: community.data ? `c/${community.data.slug}` : '' }} />
      <FeedList
        scope={{ communityId }}
        sort={sort}
        header={
          <View style={styles.header}>
            {community.data && (
              <View style={styles.heading}>
                <CommunityAvatar name={community.data.name} size={48} />
                <View style={styles.headingText}>
                  <ThemedText style={styles.name}>{community.data.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    c/{community.data.slug}
                  </ThemedText>
                </View>
              </View>
            )}
            <SortMenu value={sort} onChange={setSort} />
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    gap: Spacing.four,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headingText: {
    flex: 1,
  },
  name: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
  },
});
