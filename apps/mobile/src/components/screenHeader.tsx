import { useNavigation } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type ScreenHeaderProps = {
  // Un título, o algo propio en su lugar (ej. la barra de búsqueda de Inicio).
  title?: string;
  center?: ReactNode;
  right?: ReactNode;
};

// Cabecera de las pestañas: ☰ (abre el sidebar), título (o lo que se ponga en
// el centro) y una acción opcional a la derecha.
export function ScreenHeader({ title, center, right }: ScreenHeaderProps) {
  const theme = useTheme();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { borderBottomColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir menú"
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        hitSlop={8}>
        <Icon name="menu" />
      </Pressable>

      <View style={styles.center}>
        {center ?? (
          <ThemedText accessibilityRole="header" style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
        )}
      </View>

      {right && <View style={styles.right}>{right}</View>}
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
  center: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
