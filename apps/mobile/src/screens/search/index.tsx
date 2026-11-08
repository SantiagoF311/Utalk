import { SEARCH_QUERY_MAX_LENGTH, SEARCH_QUERY_MIN_LENGTH } from '@utalk/shared';
import type { CommunityView, Panel, PostSort, SearchResult, SearchSort } from '@utalk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { CommunityAvatar } from '@/components/communityAvatar';
import { Icon } from '@/components/icon';
import { SearchResultCard } from '@/components/searchResultCard';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCommunity, useSearch } from '@/hooks/queries';
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

type SearchScreenProps = {
  // Panel desde el que se abrió (Inicio)…
  panelId?: string;
  // …o comunidad (su 🔍): se busca solo en ella, con un chip para quitar el
  // filtro y pasar a todo su panel, como en Reddit.
  communityId?: string;
};

// Buscar (diseño 6a–6c): publicaciones y comentarios del panel elegido (con
// opción de ampliar al general) o de una comunidad. Se busca contenido, nunca
// apodos.
export function SearchScreen({ panelId: initialPanelId, communityId }: SearchScreenProps) {
  const theme = useTheme();
  const { panels, myPanel, generalPanel } = useMyPanels();
  const community = useCommunity(communityId ?? '', { enabled: !!communityId });
  const [text, setText] = useState('');
  const [chosenPanelId, setChosenPanelId] = useState<string | null>(null);
  // Mientras sea true (y se haya venido de una comunidad), se busca solo en ella.
  const [inCommunity, setInCommunity] = useState(!!communityId);
  const [sort, setSort] = useState<SearchSort>('relevance');
  const query = useDebouncedValue(text.trim(), 400);

  const scopedCommunity = inCommunity ? community.data : undefined;
  const panel =
    panels.find((p) => p.id === (chosenPanelId ?? initialPanelId ?? community.data?.panelId)) ??
    myPanel ??
    generalPanel;
  // Chips: el panel desde el que se vino y el general (o el tuyo, si se vino
  // del general).
  const panelOptions = [panel, panel?.universityId === null ? myPanel : generalPanel].filter(
    (p, index, list): p is Panel => p !== undefined && list.findIndex((o) => o?.id === p.id) === index,
  );
  const scopeName = scopedCommunity
    ? `c/${scopedCommunity.slug}`
    : panel?.universityId === null
      ? 'General'
      : (panel?.name ?? '');

  const searching = query.length >= SEARCH_QUERY_MIN_LENGTH;
  const results = useSearch(
    inCommunity && communityId ? { communityId } : { panelId: panel?.id ?? '' },
    query,
    sort,
  );

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
              placeholder={scopedCommunity ? `Buscar en c/${scopedCommunity.slug}` : 'Buscar en publicaciones y comentarios'}
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
            {scopedCommunity ? (
              <CommunityFilter slug={scopedCommunity.slug} name={scopedCommunity.name} onClear={() => setInCommunity(false)} />
            ) : (
              panelOptions.map((option) => (
                <Chip
                  key={option.id}
                  label={option.universityId === null ? 'General' : option.name}
                  selected={option.id === panel.id}
                  onPress={() => setChosenPanelId(option.id)}
                />
              ))
            )}
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
          <BeforeSearching
            onPick={setText}
            community={scopedCommunity}
            onClearCommunity={() => setInCommunity(false)}
          />
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
                  Resultados en {scopeName}
                </ThemedText>
              ) : undefined
            }
            ListEmptyComponent={
              <NoResults
                query={query}
                scopeName={scopeName}
                communityId={scopedCommunity?.id}
                widen={
                  scopedCommunity
                    ? {
                        label: `Buscar en todo ${panel.universityId === null ? 'General' : panel.name}`,
                        onPress: () => setInCommunity(false),
                      }
                    : otherPanelWiden(panelOptions.find((option) => option.id !== panel.id), setChosenPanelId)
                }
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

type BeforeSearchingProps = {
  onPick: (query: string) => void;
  // Si se busca dentro de una comunidad.
  community: CommunityView | undefined;
  onClearCommunity: () => void;
};

// Antes de escribir (6a): dentro de una comunidad, dónde se busca y atajos a
// su feed (como Reddit); después, búsquedas recientes y por qué no se busca
// por apodo.
function BeforeSearching({ onPick, community, onClearCommunity }: BeforeSearchingProps) {
  const theme = useTheme();
  const recent = useRecentSearches();

  // Vuelve a la comunidad (que está detrás en la pila) con ese orden.
  const openFeed = (sort: PostSort) => {
    if (!community) return;
    router.dismissTo({ pathname: '/community/[communityId]', params: { communityId: community.id, sort } });
  };

  return (
    <View style={styles.content}>
      {community && (
        <View style={styles.scopeBlock}>
          <View style={styles.scopeRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Buscando en
            </ThemedText>
            <CommunityFilter slug={community.slug} name={community.name} onClear={onClearCommunity} />
          </View>
          <Pressable accessibilityRole="button" onPress={() => openFeed('hot')} style={styles.shortcut}>
            <Icon name="popular" size={20} color="textSecondary" />
            <ThemedText>
              Lo mejor de <ThemedText style={styles.bold}>c/{community.slug}</ThemedText>
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => openFeed('new')} style={styles.shortcut}>
            <Icon name="recent" size={20} color="textSecondary" />
            <ThemedText>
              Nuevo en <ThemedText style={styles.bold}>c/{community.slug}</ThemedText>
            </ThemedText>
          </Pressable>
        </View>
      )}
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

// El chip "c/… ✕" de cuando se busca dentro de una comunidad: la ✕ quita el
// filtro y pasa a buscar en todo su panel.
function CommunityFilter({ slug, name, onClear }: { slug: string; name: string; onClear: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.communityChip, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <CommunityAvatar name={name} size={20} />
      <ThemedText type="smallBold">c/{slug}</ThemedText>
      <Pressable accessibilityRole="button" accessibilityLabel={`Dejar de buscar solo en c/${slug}`} onPress={onClear} hitSlop={8}>
        <Icon name="close" size={16} color="textSecondary" />
      </Pressable>
    </View>
  );
}

type Widen = { label: string; onPress: () => void };

// "Buscar en <el otro panel>", si hay otro panel al que ampliar.
function otherPanelWiden(otherPanel: Panel | undefined, onSearchIn: (panelId: string) => void): Widen | undefined {
  if (!otherPanel) return undefined;
  return {
    label: `Buscar en ${otherPanel.universityId === null ? 'General' : otherPanel.name}`,
    onPress: () => onSearchIn(otherPanel.id),
  };
}

type NoResultsProps = {
  query: string;
  scopeName: string;
  // Si se buscaba en una comunidad: la pregunta se publica ahí.
  communityId: string | undefined;
  widen: Widen | undefined;
};

// Sin resultados (6c): la salida es preguntarlo, o ampliar la búsqueda.
function NoResults({ query, scopeName, communityId, widen }: NoResultsProps) {
  return (
    <View style={styles.noResults}>
      <StateMessage
        kind="empty"
        title={`Nadie ha escrito sobre eso en ${scopeName}`}
        description="Puedes preguntarlo tú: las dudas sin respuesta suelen ser las que más comentarios traen."
      />
      <Button
        title="Publicar esta pregunta"
        onPress={() =>
          router.push({ pathname: '/compose', params: communityId ? { title: query, communityId } : { title: query } })
        }
      />
      {widen && <Button title={widen.label} variant="ghost" onPress={widen.onPress} />}
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
  scopeBlock: {
    gap: Spacing.one,
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  communityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.two + Spacing.half,
    borderRadius: 999,
    borderWidth: 1,
  },
  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  bold: {
    fontWeight: 700,
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
