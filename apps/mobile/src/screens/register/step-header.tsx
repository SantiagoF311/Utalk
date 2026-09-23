import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TOTAL_STEPS = 3;

type StepHeaderProps = {
  step: number;
  onBack: () => void;
};

export function StepHeader({ step, onBack }: StepHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack} hitSlop={8}>
          <SymbolView
            tintColor={theme.text}
            name={{ ios: 'chevron.left', android: 'arrow_back' }}
            size={20}
          />
        </Pressable>
        <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Paso {step} de {TOTAL_STEPS}
          </ThemedText>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
        <View
          style={[styles.fill, { backgroundColor: theme.primary, width: `${(step / TOTAL_STEPS) * 100}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.four,
  },
  track: {
    height: 4,
    borderRadius: Spacing.half,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Spacing.half,
  },
});
