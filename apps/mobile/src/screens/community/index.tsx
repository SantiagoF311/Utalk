import type { CommunityView, PostSort } from '@utalk/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, SheetOption } from '@/components/bottomSheet';
import { CommunityAvatar } from '@/components/communityAvatar';
import { FeedList } from '@/components/feedList';
import { Icon, IconName } from '@/components/icon';
import { JoinButton } from '@/components/joinButton';
import { SortMenu } from '@/components/sortMenu';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { toggleMembership } from '@/hooks/mutations';
import { useCommunity } from '@/hooks/queries';
import { useMyPanels } from '@/hooks/useMyPanels';
import { recordCommunityVisit } from '@/hooks/useRecentCommunities';
import { useTheme } from '@/hooks/useTheme';
import { COMMUNITY_TOPIC_LABELS, memberCountLabel } from '@/lib/communityTopics';

type CommunityScreenProps = {
  communityId: string;
  // Orden con el que abrir (ej. "Nuevo en c/…" desde la búsqueda).
  sort?: PostSort;
};

// Una comunidad: su barra (como la de Reddit), su cabecera y su feed. Abrirla
// la anota en "Visitadas recientemente".
export function CommunityScreen({ communityId, sort: requestedSort }: CommunityScreenProps) {
  const community = useCommunity(communityId);
  const { publishable } = useMyPanels();
  const [sort, setSort] = useState<PostSort>(requestedSort ?? 'hot');
  const [lastRequestedSort, setLastRequestedSort] = useState(requestedSort);
  const canPublish = publishable.some((panel) => panel.id === community.data?.panelId);

  // Si se vuelve a esta pantalla pidiendo otro orden ("Nuevo en c/…" desde la
  // búsqueda), se aplica. Se compara durante el render (no en un efecto), como
  // recomienda React para ajustar estado cuando cambia una prop.
  if (requestedSort !== lastRequestedSort) {
    setLastRequestedSort(requestedSort);
    if (requestedSort) setSort(requestedSort);
  }

  useEffect(() => {
    if (community.data) void recordCommunityVisit(community.data);
  }, [community.data]);

  return (
    <ThemedView style={styles.container}>
      <CommunityBar community={community.data} communityId={communityId} canPublish={canPublish} />
      <FeedList
        scope={{ communityId }}
        sort={sort}
        header={
          <View style={styles.header}>
            {community.data && (
              <View style={styles.about}>
                <View style={styles.heading}>
                  <CommunityAvatar name={community.data.name} size={48} />
                  <View style={styles.headingText}>
                    <ThemedText style={styles.name}>c/{community.data.slug}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {memberCountLabel(community.data.memberCount)} ·{' '}
                      {COMMUNITY_TOPIC_LABELS[community.data.topic]}
                    </ThemedText>
                  </View>
                  <JoinButton community={community.data} />
                </View>
                {community.data.description !== '' && (
                  <ThemedText type="small">{community.data.description}</ThemedText>
                )}
              </View>
            )}
            <SortMenu value={sort} onChange={setSort} />
          </View>
        }
      />
    </ThemedView>
  );
}

type CommunityBarProps = {
  community: CommunityView | undefined;
  communityId: string;
  canPublish: boolean;
};

// La barra de arriba, como la de Reddit: una franja de color con botones
// redondos. ← volver | 🔍 buscar en la comunidad, + publicar en ella (si se
// puede) y ··· (unirse o salirse).
function CommunityBar({ community, communityId, canPublish }: CommunityBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={[styles.bar, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
      <BarButton icon="back" label="Volver" onPress={() => router.back()} />
      <View style={styles.barRight}>
        <BarButton
          icon="search"
          label="Buscar en esta comunidad"
          onPress={() => router.push({ pathname: '/search', params: { communityId } })}
        />
        {canPublish && (
          <BarButton
            icon="plus"
            label="Publicar en esta comunidad"
            onPress={() => router.push({ pathname: '/compose', params: { communityId } })}
          />
        )}
        {community && <BarButton icon="more" label="Más opciones" onPress={() => setMenuOpen(true)} />}
      </View>

      {community && (
        <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
          <SheetOption
            icon={community.joinedByMe ? 'close' : 'plus'}
            label={community.joinedByMe ? `Salirse de c/${community.slug}` : `Unirse a c/${community.slug}`}
            onPress={() => {
              setMenuOpen(false);
              toggleMembership(community);
            }}
          />
        </BottomSheet>
      )}
    </View>
  );
}

function BarButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.barButton, pressed && styles.barButtonPressed]}>
      <Icon name={icon} size={20} color="onPrimary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  barRight: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  // Botón redondo semitransparente sobre el color de la barra.
  barButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  barButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  header: {
    gap: Spacing.four,
  },
  about: {
    gap: Spacing.three,
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
