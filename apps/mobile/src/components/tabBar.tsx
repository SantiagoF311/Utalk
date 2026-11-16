import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, IconName } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useConversations } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';

// Orden visual de las pestañas. No es el orden en que se declaran en el
// layout: ver app/(drawer)/(tabs)/_layout.tsx.
const TABS: { name: string; icon: IconName }[] = [
  { name: 'index', icon: 'home' },
  { name: 'communities', icon: 'communities' },
  { name: 'chats', icon: 'chats' },
  { name: 'profile', icon: 'profile' },
];

// Barra de abajo propia: es la que decide el orden visual de las pestañas
// (con la de Expo Router, el orden lo pondría la declaración del layout).
// Publicar no va acá: es el "+" de arriba en Inicio, como en Reddit.
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const unreadChats = useUnreadChats();

  const focusedKey = state.routes[state.index]?.key;
  const routes = TABS.flatMap((tab) => {
    const route = state.routes.find((r) => r.name === tab.name);
    return route ? [{ route, icon: tab.icon }] : [];
  });

  const tabs = routes.map(({ route, icon }) => {
    const focused = route.key === focusedKey;
    const label = descriptors[route.key]?.options.title ?? route.name;
    const color = focused ? 'primary' : 'textSecondary';

    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigateToTab(route.key);
    };

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={onPress}
        style={styles.tab}>
        <View>
          <Icon name={icon} size={22} color={color} />
          {route.name === 'chats' && unreadChats > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" themeColor="onPrimary" style={styles.badgeText}>
                {unreadChats > 99 ? '99+' : unreadChats}
              </ThemedText>
            </View>
          )}
        </View>
        <ThemedText type="small" themeColor={color} style={styles.label}>
          {label}
        </ThemedText>
      </Pressable>
    );
  });

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom },
      ]}>
      {tabs}
    </View>
  );
}

// Mensajes sin leer en tus chats (las solicitudes no cuentan: tienen su
// propia pestaña dentro de Chats). Se actualiza por Realtime.
function useUnreadChats(): number {
  const conversations = useConversations();
  return (conversations.data ?? [])
    .filter((conversation) => conversation.status !== 'request_received')
    .reduce((total, conversation) => total + conversation.unreadCount, 0);
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
  },
});
