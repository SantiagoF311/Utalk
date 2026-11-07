import type { PostSort } from '@utalk/shared';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, IconName } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export const SORT_OPTIONS: { value: PostSort; label: string; icon: IconName }[] = [
  { value: 'hot', label: 'Popular', icon: 'popular' },
  { value: 'new', label: 'Reciente', icon: 'recent' },
  { value: 'top', label: 'Más votados', icon: 'upvote' },
];

type SortMenuProps = {
  value: PostSort;
  onChange: (sort: PostSort) => void;
};

// Como en Reddit: una fila con el orden actual ("POPULAR ▾") que abre una
// hoja desde abajo para elegir otro.
export function SortMenu({ value, onChange }: SortMenuProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((option) => option.value === value) ?? SORT_OPTIONS[0];

  const choose = (sort: PostSort) => {
    onChange(sort);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ordenar publicaciones: ${current.label}`}
        onPress={() => setOpen(true)}
        style={styles.trigger}
        hitSlop={8}>
        <Icon name={current.icon} size={18} color="textSecondary" />
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.triggerLabel}>
          {current.label.toUpperCase()}
        </ThemedText>
        <Icon name="chevronDown" size={16} color="textSecondary" />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={styles.backdrop}
          onPress={() => setOpen(false)}
        />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.sheetHeader}>
            <ThemedText style={styles.sheetTitle}>Ordenar publicaciones por</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={() => setOpen(false)}
              style={[styles.close, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="close" size={18} />
            </Pressable>
          </View>

          {SORT_OPTIONS.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => choose(option.value)}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: theme.backgroundElement }]}>
                <Icon name={option.icon} size={22} />
                <ThemedText style={styles.optionLabel}>{option.label}</ThemedText>
                {selected && <Icon name="check" size={20} color="primary" />}
              </Pressable>
            );
          })}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
  triggerLabel: {
    letterSpacing: 0.5,
  },
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
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  sheetTitle: {
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
