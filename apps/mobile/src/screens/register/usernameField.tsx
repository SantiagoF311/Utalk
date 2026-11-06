import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from '@utalk/shared';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/textField';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { UsernameAvailability } from '@/screens/register/useUsernameAvailability';

type UsernameFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  availability: UsernameAvailability;
};

export function UsernameField({ value, onChangeText, availability }: UsernameFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <TextField
        label="Usuario"
        value={value}
        onChangeText={onChangeText}
        placeholder="juan_perez"
        autoCapitalize="none"
        autoCorrect={false}
        trailingIcon={
          availability.status === 'available' ? (
            <SymbolView
              tintColor={theme.success}
              name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }}
              size={20}
            />
          ) : availability.status === 'taken' ? (
            <SymbolView
              tintColor={theme.warning}
              name={{ ios: 'xmark.circle.fill', android: 'cancel' }}
              size={20}
            />
          ) : undefined
        }
      />
      {availability.status === 'taken' && (
        <ThemedText type="small" themeColor="warning">
          Ese usuario ya está en uso.
        </ThemedText>
      )}
      {availability.status === 'invalid' && (
        <ThemedText type="small" themeColor="textSecondary">
          Entre {USERNAME_MIN_LENGTH} y {USERNAME_MAX_LENGTH} caracteres.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
});
