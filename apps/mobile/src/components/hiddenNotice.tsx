import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type HiddenNoticeProps = {
  title: string;
  description: string;
  onReveal: () => void;
  // En el feed va como tarjeta con borde; en el detalle y en los
  // comentarios, suelto.
  bordered?: boolean;
};

// Lo que se ve en lugar de algo que reportaste (diseño 1e): queda oculto para
// ti, con "Ver igual" por si quieres leerlo.
export function HiddenNotice({ title, description, onReveal, bordered = true }: HiddenNoticeProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        bordered && [styles.bordered, { borderColor: theme.border, backgroundColor: theme.background }],
      ]}>
      <Icon name="hidden" size={20} color="textSecondary" />
      <View style={styles.text}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
      <Pressable accessibilityRole="button" onPress={onReveal} hitSlop={8}>
        <ThemedText type="smallBold" themeColor="primary">
          Ver igual
        </ThemedText>
      </Pressable>
    </View>
  );
}

// Franja sobre algo reportado que se eligió ver igual: deja claro que lo
// reportaste y permite volver a ocultarlo.
export function ReportedBanner({ label, onHide }: { label: string; onHide: () => void }) {
  return (
    <View style={styles.banner}>
      <Icon name="flag" size={14} color="textSecondary" />
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        {label}
      </ThemedText>
      <Pressable accessibilityRole="button" onPress={onHide} hitSlop={8}>
        <ThemedText type="smallBold" themeColor="primary">
          Ocultar
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  bordered: {
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
