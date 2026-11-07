import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FeedList } from '@/components/feedList';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { useCommunities, usePanel } from '@/hooks/queries';

// Un panel: sus comunidades (para entrar a una) y el feed de todas juntas.
export function PanelScreen({ panelId }: { panelId: string }) {
  const panel = usePanel(panelId);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: panel.data?.name ?? '' }} />
      <PanelFeed panelId={panelId} />
    </ThemedView>
  );
}

function PanelFeed({ panelId }: { panelId: string }) {
  const communities = useCommunities(panelId);
  const communityNames = useMemo(
    () => new Map(communities.data?.map((community) => [community.id, community.name])),
    [communities.data],
  );

  return (
    <FeedList
      scope={{ panelId }}
      communityNames={communityNames}
      header={
        communities.data && communities.data.length > 0 ? (
          <View style={styles.communities}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Comunidades
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.communityRow}>
                {communities.data.map((community) => (
                  <Pressable
                    key={community.id}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({ pathname: '/community/[communityId]', params: { communityId: community.id } })
                    }
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedView type="backgroundElement" style={styles.communityChip}>
                      <ThemedText type="small">{community.name}</ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  communities: {
    gap: Spacing.two,
  },
  communityRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  communityChip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
