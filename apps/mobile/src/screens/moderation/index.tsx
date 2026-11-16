import type { ModerationCase, ModerationScope } from '@utalk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { ConfirmSheet } from '@/components/confirmSheet';
import { Icon } from '@/components/icon';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useResolveReports } from '@/hooks/mutations';
import { useModerationQueue, useModerationScope } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';
import { relativeTime } from '@/lib/relativeTime';
import { REPORT_CATEGORY_LABELS } from '@/lib/reportLabels';

// Cola de moderación (moderadores de comunidad y admins): cada tarjeta es un
// post o comentario con todos sus reportes pendientes, lo más grave primero.
// Eliminar lo saca de la app ("eliminado por moderación"); Dejar lo deja como
// está. En los dos casos se cierran sus reportes.
export function ModerationScreen() {
  const theme = useTheme();
  const scope = useModerationScope();
  // null = todas las que modera.
  const [communityId, setCommunityId] = useState<string | null>(null);
  const queue = useModerationQueue(communityId);

  const empty = queue.isPending ? (
    <StateMessage kind="loading" />
  ) : queue.isError ? (
    <StateMessage kind="error" message={errorMessage(queue.error)} onRetry={() => void queue.refetch()} />
  ) : (
    <StateMessage
      kind="empty"
      title="No hay nada pendiente"
      description="Cuando alguien reporte algo en lo que moderas, aparece acá."
    />
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <FlatList<ModerationCase>
          data={queue.data ?? []}
          keyExtractor={(entry) => entry.commentId ?? entry.postId}
          renderItem={({ item }) => <CaseCard entry={item} />}
          ListHeaderComponent={
            scope.data ? (
              <CommunityFilter scope={scope.data} selected={communityId} onSelect={setCommunityId} />
            ) : undefined
          }
          ListEmptyComponent={empty}
          ItemSeparatorComponent={Separator}
          refreshControl={
            <RefreshControl
              refreshing={queue.isRefetching}
              onRefresh={() => void queue.refetch()}
              tintColor={theme.textSecondary}
            />
          }
          contentContainerStyle={styles.content}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

type CommunityFilterProps = {
  scope: ModerationScope;
  selected: string | null;
  onSelect: (communityId: string | null) => void;
};

// "Todas" y una pastilla por comunidad que modera. Con una sola comunidad (y
// sin ser admin) no hay nada que elegir.
function CommunityFilter({ scope, selected, onSelect }: CommunityFilterProps) {
  if (!scope.isAdmin && scope.communities.length <= 1) return null;
  const options = [
    { id: null, label: scope.isAdmin ? 'Todas' : 'Mis comunidades' },
    ...scope.communities.map((community) => ({ id: community.id, label: `c/${community.slug}` })),
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filter}>
      {options.map((option) => (
        <Chip
          key={option.id ?? 'all'}
          label={option.label}
          selected={option.id === selected}
          onPress={() => onSelect(option.id)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.primarySoft : theme.backgroundElement }]}>
      <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'primary' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const URGENT = new Set(['threat', 'exposes_person']);

function CaseCard({ entry }: { entry: ModerationCase }) {
  const theme = useTheme();
  const resolve = useResolveReports();
  const [confirming, setConfirming] = useState(false);
  const isComment = entry.commentId !== null;
  const isUrgent = entry.categories.some((category) => URGENT.has(category));
  const what = isComment ? 'el comentario' : 'la publicación';

  const remove = () =>
    resolve.mutate({ entry, action: 'remove' }, { onSuccess: () => setConfirming(false) });

  return (
    <View style={[styles.card, { borderColor: isUrgent ? theme.warning : theme.border }]}>
      <View style={styles.meta}>
        {isUrgent && (
          <View style={[styles.badge, { backgroundColor: theme.warning }]}>
            <ThemedText type="smallBold" style={styles.badgeText}>
              Urgente
            </ThemedText>
          </View>
        )}
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
          c/{entry.community.slug} · {isComment ? 'Comentario' : 'Publicación'} ·{' '}
          {relativeTime(entry.firstReportedAt)}
        </ThemedText>
      </View>

      {isComment ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          En «{entry.postTitle}»
        </ThemedText>
      ) : (
        <ThemedText style={styles.title}>{entry.postTitle}</ThemedText>
      )}
      <ThemedText type="small" numberOfLines={8}>
        {entry.body}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        u/{entry.author.username}
        {entry.isDeleted ? ' · su autor lo borró después del reporte' : ''}
      </ThemedText>

      <View style={[styles.reports, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">
          {entry.reportCount === 1 ? '1 reporte' : `${entry.reportCount} reportes`}
        </ThemedText>
        <ThemedText type="small">
          {entry.categories.map((category) => REPORT_CATEGORY_LABELS[category]).join(' · ')}
        </ThemedText>
        {entry.reasons.map((reason, index) => (
          <ThemedText key={index} type="small" themeColor="textSecondary">
            “{reason}”
          </ThemedText>
        ))}
      </View>

      {resolve.isError && !confirming && <Callout variant="warning">{errorMessage(resolve.error)}</Callout>}

      <View style={styles.actions}>
        <Button
          title="Eliminar"
          variant="strong"
          style={styles.flex}
          disabled={resolve.isPending}
          onPress={() => setConfirming(true)}
        />
        <Button
          title="Dejar"
          variant="ghost"
          style={styles.flex}
          loading={resolve.isPending && resolve.variables?.action === 'dismiss'}
          disabled={resolve.isPending}
          onPress={() => resolve.mutate({ entry, action: 'dismiss' })}
        />
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push({ pathname: '/post/[postId]', params: { postId: entry.postId } })}
        hitSlop={8}
        style={styles.openPost}>
        <ThemedText type="small" themeColor="primary">
          Ver la publicación
        </ThemedText>
        <Icon name="chevronRight" size={14} color="primary" />
      </Pressable>

      <ConfirmSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        title={`¿Eliminar ${what}?`}
        description={
          isComment
            ? 'Se va a ver como "eliminado por moderación". Las respuestas se quedan.'
            : 'Desaparece de la app para todos, con sus comentarios. Los reportes quedan cerrados.'
        }
        confirmLabel="Sí, eliminar"
        cancelLabel="Volver"
        onConfirm={remove}
        loading={resolve.isPending}
        errorMessage={resolve.isError ? errorMessage(resolve.error) : null}
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
  filter: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 700,
  },
  reports: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  openPost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
  separator: {
    height: Spacing.three,
  },
  flex: {
    flex: 1,
  },
});
