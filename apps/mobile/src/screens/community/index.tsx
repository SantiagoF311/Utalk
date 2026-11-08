import type { PostSort } from '@utalk/shared';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CommunityAvatar } from '@/components/communityAvatar';
import { FeedList } from '@/components/feedList';
import { Icon } from '@/components/icon';
import { SortMenu } from '@/components/sortMenu';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { useCommunity } from '@/hooks/queries';
import { useMyPanels } from '@/hooks/useMyPanels';
import { recordCommunityVisit } from '@/hooks/useRecentCommunities';

// Una comunidad: su feed. Abrirla la anota en "Visitadas recientemente".
export function CommunityScreen({ communityId }: { communityId: string }) {
  const community = useCommunity(communityId);
  const { publishable } = useMyPanels();
  const [sort, setSort] = useState<PostSort>('hot');
  const canPublish = publishable.some((panel) => panel.id === community.data?.panelId);

  useEffect(() => {
    if (community.data) void recordCommunityVisit(community.data);
  }, [community.data]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: community.data ? `c/${community.data.slug}` : '',
          // "+" para publicar acá, solo si es de un panel donde puedes publicar.
          headerRight: canPublish
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Publicar en esta comunidad"
                  onPress={() => router.push({ pathname: '/compose', params: { communityId } })}
                  hitSlop={8}>
                  <Icon name="plus" />
                </Pressable>
              )
            : undefined,
        }}
      />
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
