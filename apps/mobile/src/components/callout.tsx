import { SymbolView } from 'expo-symbols';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CalloutVariant = 'info' | 'warning';

type CalloutProps = {
  variant?: CalloutVariant;
  children: ReactNode;
};

export function Callout({ variant = 'info', children }: CalloutProps) {
  const theme = useTheme();
  const isWarning = variant === 'warning';

  return (
    <View style={styles.container}>
      <SymbolView
        tintColor={isWarning ? theme.warning : theme.primary}
        name={{
          ios: isWarning ? 'exclamationmark.triangle.fill' : 'info.circle.fill',
          android: isWarning ? 'warning' : 'info',
        }}
        size={16}
        style={styles.icon}
      />
      <ThemedText type="small" themeColor={isWarning ? 'warning' : 'textSecondary'} style={styles.text}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  icon: {
    marginTop: 2,
  },
  text: {
    flex: 1,
    lineHeight: 19,
  },
});
