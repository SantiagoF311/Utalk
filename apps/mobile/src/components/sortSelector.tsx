import type { PostSort } from '@utalk/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';

const OPTIONS: { value: PostSort; label: string }[] = [
  { value: 'hot', label: 'Populares' },
  { value: 'new', label: 'Nuevos' },
  { value: 'top', label: 'Top' },
];

type SortSelectorProps = {
  value: PostSort;
  onChange: (sort: PostSort) => void;
};

export function SortSelector({ value, onChange }: SortSelectorProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}>
            <ThemedView
              type={selected ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.chip}>
              <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
                {option.label}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
