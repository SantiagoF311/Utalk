import type { CommunityTopic, CommunityView } from '@utalk/shared';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommunityAvatar } from '@/components/communityAvatar';
import { Icon } from '@/components/icon';
import { JoinButton } from '@/components/joinButton';
import { ScreenHeader } from '@/components/screenHeader';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCommunities } from '@/hooks/queries';
import { useFeedSelection } from '@/hooks/useFeedSelection';
import { useTheme } from '@/hooks/useTheme';
import { COMMUNITY_TOPIC_OPTIONS, memberCountLabel } from '@/lib/communityTopics';
import { errorMessage } from '@/lib/errorMessages';
import { normalize } from '@/lib/text';

// Comunidades: las del panel elegido en el sidebar, con chips por tema y un
// buscador. Es la pestaña "Comunidades" de Reddit, en versión simple.
export function CommunitiesScreen() {
  const { panel } = useFeedSelection();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader
          title="Comunidades"
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={searching ? 'Cerrar búsqueda' : 'Buscar comunidad'}
              onPress={() => {
                setSearching((value) => !value);
                setQuery('');
              }}
              hitSlop={8}>
              <Icon name={searching ? 'close' : 'search'} />
            </Pressable>
          }
        />
        {panel ? (
          <CommunityList panelId={panel.id} panelName={panel.name} query={searching ? query : ''}>
            {searching && <SearchField value={query} onChange={setQuery} />}
          </CommunityList>
        ) : (
          <StateMessage kind="loading" />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

type CommunityListProps = {
  panelId: string;
  panelName: string;
  query: string;
  children?: ReactNode;
};

function CommunityList({ panelId, panelName, query, children }: CommunityListProps) {
  const communities = useCommunities(panelId);
  const [topic, setTopic] = useState<CommunityTopic | null>(null);

  if (communities.isPending) return <StateMessage kind="loading" />;
  if (communities.isError) {
    return (
      <StateMessage
        kind="error"
        message={errorMessage(communities.error)}
        onRetry={() => void communities.refetch()}
      />
    );
  }

  const normalized = normalize(query.trim());
  // Chips solo de los temas que tienen alguna comunidad en este panel.
  const topics = COMMUNITY_TOPIC_OPTIONS.filter((option) =>
    communities.data.some((c) => c.topic === option.value),
  );
  const visible = communities.data.filter(
    (c) =>
      (topic === null || c.topic === topic) &&
      (!normalized || normalize(c.name).includes(normalized) || c.slug.includes(normalized)),
  );

  return (
    <FlatList<CommunityView>
      data={visible}
      keyExtractor={(community) => community.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          {children}
          {topics.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics}>
              <TopicChip label="Todas" selected={topic === null} onPress={() => setTopic(null)} />
              {topics.map((option) => (
                <TopicChip
                  key={option.value}
                  label={option.label}
                  selected={topic === option.value}
                  onPress={() => setTopic(option.value)}
                />
              ))}
            </ScrollView>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {normalized ? `Resultados en ${panelName}` : `Comunidades de ${panelName}`}
          </ThemedText>
        </View>
      }
      ListEmptyComponent={
        normalized || topic ? (
          <StateMessage kind="empty" title="No hay comunidades así" />
        ) : (
          <StateMessage
            kind="empty"
            title={`Todavía no hay comunidades en ${panelName}`}
            description="Cuando alguien cree una, va a aparecer acá."
          />
        )
      }
      ItemSeparatorComponent={Separator}
      renderItem={({ item }) => <CommunityRow community={item} />}
    />
  );
}

function CommunityRow({ community }: { community: CommunityView }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/community/[communityId]', params: { communityId: community.id } })}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.border },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <CommunityAvatar name={community.name} size={40} />
      <View style={styles.rowText}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {community.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          c/{community.slug} · {memberCountLabel(community.memberCount)}
        </ThemedText>
        {community.description !== '' && (
          <ThemedText type="small" numberOfLines={2} style={styles.description}>
            {community.description}
          </ThemedText>
        )}
      </View>
      <JoinButton community={community} />
    </Pressable>
  );
}

function TopicChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.topicChip,
        selected ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: theme.border },
      ]}>
      <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'onPrimary' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
      <Icon name="search" size={18} color="textSecondary" />
      <TextInput
        autoFocus
        value={value}
        onChangeText={onChange}
        placeholder="Buscar comunidad"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[styles.searchInput, { color: theme.text }]}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  name: {
    fontWeight: 700,
  },
  description: {
    marginTop: Spacing.half,
  },
  topics: {
    gap: Spacing.two,
  },
  topicChip: {
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
  },
  separator: {
    height: Spacing.two,
  },
});
