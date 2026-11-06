import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type StateMessageProps =
  | { kind: 'loading' }
  | { kind: 'empty'; title: string; description?: string }
  | { kind: 'error'; message: string; onRetry: () => void };

// Lo que se muestra en lugar de una lista mientras carga, si está vacía o
// si falló.
export function StateMessage(props: StateMessageProps) {
  const theme = useTheme();

  if (props.kind === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }

  if (props.kind === 'empty') {
    return (
      <View style={styles.container}>
        <ThemedText type="smallBold">{props.title}</ThemedText>
        {props.description && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {props.description}
          </ThemedText>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {props.message}
      </ThemedText>
      <Button title="Reintentar" variant="ghost" onPress={props.onRetry} style={styles.retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  center: {
    textAlign: 'center',
  },
  retry: {
    marginTop: Spacing.two,
    height: 44,
  },
});
