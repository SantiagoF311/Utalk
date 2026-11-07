import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, IconName } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

// Orden visual de las pestañas (el botón de publicar va al medio). No es el
// orden en que se declaran en el layout: ver app/(drawer)/(tabs)/_layout.tsx.
const TABS: { name: string; icon: IconName }[] = [
  { name: 'index', icon: 'home' },
  { name: 'communities', icon: 'communities' },
  { name: 'chats', icon: 'chats' },
  { name: 'profile', icon: 'profile' },
];

// Barra de abajo propia (la nativa no admite un botón en el medio): dos
// pestañas, el botón de publicar y dos pestañas más.
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const theme = useTheme();

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
        <Icon name={icon} size={22} color={color} />
        <ThemedText type="small" themeColor={color} style={styles.label}>
          {label}
        </ThemedText>
      </Pressable>
    );
  });

  const middle = Math.ceil(tabs.length / 2);

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom },
      ]}>
      {tabs.slice(0, middle)}
      <View style={styles.tab}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nueva publicación"
          onPress={() => router.push('/compose')}
          style={({ pressed }) => [styles.compose, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <Icon name="compose" size={22} color="onPrimary" />
        </Pressable>
      </View>
      {tabs.slice(middle)}
    </View>
  );
}

const styles = StyleSheet.create({
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
  compose: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    // Sobresale un poco de la barra, como en el diseño.
    marginTop: -Spacing.four,
  },
  pressed: {
    opacity: 0.85,
  },
});
