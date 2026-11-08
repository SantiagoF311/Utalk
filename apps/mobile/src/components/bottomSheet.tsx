import { ReactNode, useEffect, useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, IconName } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  // Cuando la hoja terminó de cerrarse. Para navegar a otra pantalla desde
  // una opción: en iOS, abrir un modal mientras la hoja todavía se está
  // cerrando puede fallar, así que hay que esperar a esto.
  onClosed?: () => void;
  children: ReactNode;
};

// Hoja que sube desde abajo sobre un fondo oscuro (menús de "···", orden,
// confirmaciones). Se cierra tocando el fondo, la ✕ o el botón atrás.
export function BottomSheet({ visible, onClose, title, description, onClosed, children }: BottomSheetProps) {
  const theme = useTheme();
  const wasVisible = useRef(visible);

  // En iOS lo avisa `onDismiss` del Modal; en Android y web no existe, y el
  // cierre se da por hecho apenas `visible` pasa a false.
  useEffect(() => {
    if (Platform.OS !== 'ios' && wasVisible.current && !visible) onClosed?.();
    wasVisible.current = visible;
  }, [visible, onClosed]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={Platform.OS === 'ios' ? onClosed : undefined}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: theme.background }]}>
        {title && (
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText style={styles.title}>{title}</ThemedText>
              {description && (
                <ThemedText type="small" themeColor="textSecondary">
                  {description}
                </ThemedText>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onClose}
              style={[styles.close, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="close" size={18} />
            </Pressable>
          </View>
        )}
        {children}
      </SafeAreaView>
    </Modal>
  );
}

type SheetOptionProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  selected?: boolean;
  destructive?: boolean;
};

// Una opción de la hoja: ícono, texto y ✓ si está elegida.
export function SheetOption({ label, onPress, icon, selected, destructive }: SheetOptionProps) {
  const theme = useTheme();
  const color = destructive ? 'warning' : 'text';

  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && { backgroundColor: theme.backgroundElement }]}>
      {icon && <Icon name={icon} size={22} color={color} />}
      <ThemedText themeColor={color} style={styles.optionLabel}>
        {label}
      </ThemedText>
      {selected && <Icon name="check" size={20} color="primary" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  optionLabel: {
    flex: 1,
  },
});
