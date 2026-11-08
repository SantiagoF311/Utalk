import { SEARCH_QUERY_MAX_LENGTH, SEARCH_QUERY_MIN_LENGTH } from '@utalk/shared';
import type { Panel, SearchResult, SearchSort } from '@utalk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { Icon } from '@/components/icon';
import { SearchResultCard } from '@/components/searchResultCard';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSearch } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useMyPanels } from '@/hooks/useMyPanels';
import {
  addRecentSearch,
  clearRecentSearches,
  removeRecentSearch,
  useRecentSearches,
} from '@/hooks/useRecentSearches';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';

const SORT_LABELS: Record<SearchSort, string> = { relevance: 'Relevancia', new: 'Reciente' };

// Buscar (diseño 6a–6c): publicaciones y comentarios del panel elegido, con
// opción de ampliar al general. Se busca contenido, nunca apodos.
export function SearchScreen({ panelId: initialPanelId }: { panelId?: string }) {
  const theme = useTheme();
  const { panels, myPanel, generalPanel } = useMyPanels();
  const [text, setText] = useState('');
  const [chosenPanelId, setChosenPanelId] = useState<string | null>(null);
  const [sort, setSort] = useState<SearchSort>('relevance');
  const query = useDebouncedValue(text.trim(), 400);

  const panel =
    panels.find((p) => p.id === (chosenPanelId ?? initialPanelId)) ?? myPanel ?? generalPanel;
  // Chips: el panel desde el que se vino y el general (o el tuyo, si se vino
  // del general).
  const panelOptions = [panel, panel?.universityId === null ? myPanel : generalPanel].filter(
    (p, index, list): p is Panel => p !== undefined && list.findIndex((o) => o?.id === p.id) === index,
  );

  const searching = query.length >= SEARCH_QUERY_MIN_LENGTH;
  const results = useSearch(panel?.id ?? '', query, sort);

  const remember = () => {
    if (searching) void addRecentSearch(query);
  };

  const openResult = (result: SearchResult) => {
    remember();
    router.push({
      pathname: '/post/[postId]',
      params: { postId: result.kind === 'post' ? result.id : result.postId },
    });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.searchRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} hitSlop={8}>
            <Icon name="back" />
          </Pressable>
          <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="search" size={18} color="textSecondary" />
            <TextInput
              autoFocus
              value={text}
              onChangeText={setText}
              onSubmitEditing={remember}
              placeholder="Buscar en publicaciones y comentarios"
              placeholderTextColor={theme.textSecondary}
              maxLength={SEARCH_QUERY_MAX_LENGTH}
              returnKeyType="search"
              autoCorrect={false}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {text.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" onPress={() => setText('')} hitSlop={8}>
                <Icon name="close" size={18} color="textSecondary" />
              </Pressable>
            )}
          </View>
        </View>

        {searching && panel && (
          <View style={[styles.filters, { borderBottomColor: theme.border }]}>
            {panelOptions.map((option) => (
              <Chip
                key={option.id}
                label={option.universityId === null ? 'General' : option.name}
                selected={option.id === panel.id}
                onPress={() => setChosenPanelId(option.id)}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ordenar por ${SORT_LABELS[sort === 'relevance' ? 'new' : 'relevance']}`}
              onPress={() => setSort((current) => (current === 'relevance' ? 'new' : 'relevance'))}
              style={[styles.sortButton, { borderColor: theme.border }]}>
              <Icon name={sort === 'relevance' ? 'popular' : 'recent'} size={14} color="textSecondary" />
              <ThemedText type="small" themeColor="textSecondary">
                {SORT_LABELS[sort]}
              </ThemedText>
            </Pressable>
          </View>
        )}

        {!searching || !panel ? (
          <BeforeSearching onPick={setText} />
        ) : results.isPending ? (
          <StateMessage kind="loading" />
        ) : results.isError ? (
          <StateMessage kind="error" message={errorMessage(results.error)} onRetry={() => void results.refetch()} />
        ) : (
          <FlatList<SearchResult>
            data={results.data}
            keyExtractor={(result) => `${result.kind}-${result.id}`}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.content}
            ListHeaderComponent={
              results.data.length > 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.resultsTitle}>
                  Resultados en {panel.universityId === null ? 'General' : panel.name}
                </ThemedText>
              ) : undefined
            }
            ListEmptyComponent={
              <NoResults
                query={query}
                panel={panel}
                otherPanel={panelOptions.find((option) => option.id !== panel.id)}
                onSearchIn={setChosenPanelId}
              />
            }
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" onPress={() => openResult(item)} style={({ pressed }) => pressed && styles.pressed}>
                <SearchResultCard result={item} showUniversity={panel.universityId === null} />
              </Pressable>
            )}
            ItemSeparatorComponent={Separator}
            onEndReached={() => {
              if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              results.isFetchingNextPage ? <ActivityIndicator color={theme.textSecondary} style={styles.footer} /> : undefined
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

// Antes de escribir (6a): búsquedas recientes y por qué no se busca por apodo.
function BeforeSearching({ onPick }: { onPick: (query: string) => void }) {
  const theme = useTheme();
  const recent = useRecentSearches();

  return (
    <View style={styles.content}>
      {recent.data && recent.data.length > 0 && (
        <View style={styles.recent}>
          <View style={styles.recentHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              RECIENTES
            </ThemedText>
            <Pressable accessibilityRole="button" onPress={() => void clearRecentSearches()} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="primary">
                Borrar
              </ThemedText>
            </Pressable>
          </View>
          {recent.data.map((item) => (
            <View key={item} style={[styles.recentRow, { borderBottomColor: theme.border }]}>
              <Pressable accessibilityRole="button" onPress={() => onPick(item)} style={styles.recentItem}>
                <Icon name="recent" size={18} color="textSecondary" />
                <ThemedText numberOfLines={1} style={styles.flex}>
                  {item}
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar "${item}" de recientes`}
                onPress={() => void removeRecentSearch(item)}
                hitSlop={8}>
                <Icon name="close" size={16} color="textSecondary" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <Callout>No se puede buscar por apodo. Nadie puede juntar todo lo que escribiste desde acá.</Callout>
    </View>
  );
}

type NoResultsProps = {
  query: string;
  panel: Panel;
  otherPanel: Panel | undefined;
  onSearchIn: (panelId: string) => void;
};

// Sin resultados (6c): la salida es preguntarlo, o buscar en el otro panel.
function NoResults({ query, panel, otherPanel, onSearchIn }: NoResultsProps) {
  const panelName = panel.universityId === null ? 'el panel general' : panel.name;

  return (
    <View style={styles.noResults}>
      <StateMessage
        kind="empty"
        title={`Nadie ha escrito sobre eso en ${panelName}`}
        description="Puedes preguntarlo tú: las dudas sin respuesta suelen ser las que más comentarios traen."
      />
      <Button
        title="Publicar esta pregunta"
        onPress={() => router.push({ pathname: '/compose', params: { title: query } })}
      />
      {otherPanel && (
        <Button
          title={`Buscar en ${otherPanel.universityId === null ? 'General' : otherPanel.name}`}
          variant="ghost"
          onPress={() => onSearchIn(otherPanel.id)}
        />
      )}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: theme.border },
      ]}>
      <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'onPrimary' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: 'auto',
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  resultsTitle: {
    marginBottom: Spacing.one,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  recent: {
    gap: Spacing.one,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  noResults: {
    gap: Spacing.two,
  },
  separator: {
    height: Spacing.two,
  },
  footer: {
    marginVertical: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});
