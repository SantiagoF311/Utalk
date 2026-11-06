import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FeedList } from '@/components/feedList';
import { RequireSession } from '@/components/requireSession';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { useForums, usePanel } from '@/hooks/queries';

// Un panel: sus foros (para entrar a uno) y el feed de todos ellos juntos.
export function PanelScreen({ panelId }: { panelId: string }) {
  const panel = usePanel(panelId);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: panel.data?.name ?? '' }} />
      <RequireSession>
        <PanelFeed panelId={panelId} />
      </RequireSession>
    </ThemedView>
  );
}

function PanelFeed({ panelId }: { panelId: string }) {
  const forums = useForums(panelId);
  const forumNames = useMemo(
    () => new Map(forums.data?.map((forum) => [forum.id, forum.name])),
    [forums.data],
  );

  return (
    <FeedList
      scope={{ panelId }}
      forumNames={forumNames}
      header={
        forums.data && forums.data.length > 0 ? (
          <View style={styles.forums}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Foros
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.forumRow}>
                {forums.data.map((forum) => (
                  <Pressable
                    key={forum.id}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({ pathname: '/forum/[forumId]', params: { forumId: forum.id } })
                    }
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedView type="backgroundElement" style={styles.forumChip}>
                      <ThemedText type="small">{forum.name}</ThemedText>
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
  forums: {
    gap: Spacing.two,
  },
  forumRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  forumChip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
