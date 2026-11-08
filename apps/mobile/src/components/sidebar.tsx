import type { Panel, PostSort } from '@utalk/shared';
import { router } from 'expo-router';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommunityAvatar } from '@/components/communityAvatar';
import { Icon, IconName } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useCommunities } from '@/hooks/queries';
import { useFeedSelection } from '@/hooks/useFeedSelection';
import { useMyPanels } from '@/hooks/useMyPanels';
import { useRecentCommunities } from '@/hooks/useRecentCommunities';
import { useTheme } from '@/hooks/useTheme';

const SORT_ITEMS: { sort: PostSort; label: string; icon: IconName }[] = [
  { sort: 'hot', label: 'Popular', icon: 'popular' },
  { sort: 'new', label: 'Reciente', icon: 'recent' },
];

// El sidebar, como el de Reddit: arriba el panel que estás mirando (se puede
// cambiar), y debajo todo es de ese panel: su feed por orden, crear una
// comunidad, las que visitaste y a las que te uniste.
export function Sidebar({ navigation }: DrawerContentComponentProps) {
  const theme = useTheme();
  const selection = useFeedSelection();
  const { publishable } = useMyPanels();
  const recent = useRecentCommunities(selection.panel?.id);
  const communities = useCommunities(selection.panel?.id ?? '');
  const [choosingPanel, setChoosingPanel] = useState(false);

  const canCreate = publishable.some((panel) => panel.id === selection.panel?.id);
  const joined = communities.data?.filter((community) => community.joinedByMe) ?? [];

  const openCommunity = (communityId: string) => {
    navigation.closeDrawer();
    router.push({ pathname: '/community/[communityId]', params: { communityId } });
  };

  const showFeed = (sort: PostSort) => {
    selection.setSort(sort);
    router.navigate('/');
    navigation.closeDrawer();
  };

  const choosePanel = (panelId: string) => {
    selection.selectPanel(panelId);
    setChoosingPanel(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
          PANEL
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: choosingPanel }}
          onPress={() => setChoosingPanel((value) => !value)}
          style={[styles.panelButton, { backgroundColor: theme.backgroundElement }]}>
          <Icon name={selection.panel?.universityId === null ? 'globe' : 'university'} size={20} />
          <ThemedText style={styles.panelName} numberOfLines={1}>
            {selection.panel?.name ?? 'Cargando…'}
          </ThemedText>
          <Icon name={choosingPanel ? 'chevronUp' : 'chevronDown'} size={18} color="textSecondary" />
        </Pressable>

        {choosingPanel && (
          <PanelOptions
            panels={selection.panels}
            selectedId={selection.panel?.id}
            myPanelId={selection.myPanelId}
            onChoose={choosePanel}
          />
        )}

        <Divider />

        {SORT_ITEMS.map((item) => (
          <SidebarItem
            key={item.sort}
            icon={item.icon}
            label={item.label}
            active={selection.sort === item.sort}
            onPress={() => showFeed(item.sort)}
          />
        ))}

        {/* Crear: solo en tu panel o el general, donde se puede publicar. */}
        {canCreate && (
          <SidebarItem
            icon="plus"
            label="Crear una comunidad"
            active={false}
            onPress={() => {
              navigation.closeDrawer();
              router.push({ pathname: '/create-community', params: { panelId: selection.panel?.id } });
            }}
          />
        )}

        {recent.data && recent.data.length > 0 && (
          <>
            <Divider />
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              VISITADAS RECIENTEMENTE
            </ThemedText>
            {recent.data.map((community) => (
              <SidebarCommunity key={community.id} community={community} onOpen={openCommunity} />
            ))}
          </>
        )}

        {joined.length > 0 && (
          <>
            <Divider />
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              TUS COMUNIDADES
            </ThemedText>
            {joined.map((community) => (
              <SidebarCommunity key={community.id} community={community} onOpen={openCommunity} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type PanelOptionsProps = {
  panels: Panel[];
  selectedId: string | undefined;
  myPanelId: string | undefined;
  onChoose: (panelId: string) => void;
};

// Primero el de tu universidad y el general (donde puedes publicar); después
// el resto, que puedes leer, comentar y votar.
function PanelOptions({ panels, selectedId, myPanelId, onChoose }: PanelOptionsProps) {
  const rank = (panel: Panel) => (panel.id === myPanelId ? 0 : panel.universityId === null ? 1 : 2);
  const sorted = [...panels].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  return (
    <View style={styles.panelOptions}>
      {sorted.map((panel) => {
        const selected = panel.id === selectedId;
        const hint = panel.id === myPanelId ? 'Tu universidad' : panel.universityId === null ? 'Todas las universidades' : undefined;
        return (
          <Pressable
            key={panel.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChoose(panel.id)}
            style={styles.panelOption}>
            <View style={styles.flex}>
              <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'primary' : 'text'}>
                {panel.name}
              </ThemedText>
              {hint && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                  {hint}
                </ThemedText>
              )}
            </View>
            {selected && <Icon name="check" size={18} color="primary" />}
          </Pressable>
        );
      })}
    </View>
  );
}

type SidebarCommunityProps = {
  community: { id: string; name: string; slug: string };
  onOpen: (communityId: string) => void;
};

function SidebarCommunity({ community, onOpen }: SidebarCommunityProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(community.id)}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: theme.backgroundElement }]}>
      <CommunityAvatar name={community.name} />
      <ThemedText numberOfLines={1} style={styles.flex}>
        c/{community.slug}
      </ThemedText>
    </Pressable>
  );
}

type SidebarItemProps = {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
};

function SidebarItem({ icon, label, active, onPress }: SidebarItemProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        active && { backgroundColor: theme.primarySoft },
        pressed && !active && { backgroundColor: theme.backgroundElement },
      ]}>
      <Icon name={icon} size={22} color={active ? 'primary' : 'text'} />
      <ThemedText themeColor={active ? 'primary' : 'text'}>{label}</ThemedText>
    </Pressable>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  panelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  panelName: {
    flex: 1,
    fontWeight: 700,
  },
  panelOptions: {
    paddingVertical: Spacing.one,
  },
  panelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
  },
});
