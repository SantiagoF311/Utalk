import type { PostSort } from '@utalk/shared';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { BottomSheet, SheetOption } from '@/components/bottomSheet';
import { Icon, IconName } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';

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
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((option) => option.value === value) ?? SORT_OPTIONS[0];

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

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Ordenar publicaciones por">
        {SORT_OPTIONS.map((option) => (
          <SheetOption
            key={option.value}
            icon={option.icon}
            label={option.label}
            selected={option.value === value}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
          />
        ))}
      </BottomSheet>
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
});
