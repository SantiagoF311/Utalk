import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

const SEGMENT_COUNT = 4;
const LABELS = ['Débil', 'Regular', 'Buena', 'Fuerte'] as const;

function scoreOf(password: string) {
  if (password.length === 0) return 0;
  let score = 1;
  if (password.length >= 8) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  return Math.min(score, SEGMENT_COUNT);
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const theme = useTheme();
  const score = scoreOf(password);

  if (score === 0) return null;

  return (
    <View style={styles.row}>
      <View style={styles.segments}>
        {Array.from({ length: SEGMENT_COUNT }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              { backgroundColor: index < score ? theme.success : theme.backgroundElement },
            ]}
          />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {LABELS[score - 1]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.half,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: Spacing.half,
  },
});
