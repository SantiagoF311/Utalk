import { useNavigation } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type ScreenHeaderProps = {
  title: string;
  // Tocar el título también abre el sidebar (ej. el nombre del panel en
  // Inicio, para cambiarlo).
  titleOpensSidebar?: boolean;
  right?: ReactNode;
};

// Cabecera de las pestañas: ☰ (abre el sidebar), título y una acción opcional
// a la derecha.
export function ScreenHeader({ title, titleOpensSidebar = false, right }: ScreenHeaderProps) {
  const theme = useTheme();
  const navigation = useNavigation();
  const openSidebar = () => navigation.dispatch(DrawerActions.openDrawer());

  return (
    <View style={[styles.container, { borderBottomColor: theme.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir menú" onPress={openSidebar} hitSlop={8}>
        <Icon name="menu" />
      </Pressable>

      <Pressable
        disabled={!titleOpensSidebar}
        onPress={openSidebar}
        accessibilityRole={titleOpensSidebar ? 'button' : 'header'}
        accessibilityHint={titleOpensSidebar ? 'Cambia de panel' : undefined}
        style={styles.titleRow}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        {titleOpensSidebar && <Icon name="chevronDown" size={16} color="textSecondary" />}
      </Pressable>

      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
