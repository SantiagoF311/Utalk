import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { UsernameField } from '@/screens/register/usernameField';
import { useUsernameAvailability } from '@/screens/register/useUsernameAvailability';

export function getCompleteRegistrationErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.code === 'USERNAME_TAKEN'
    ? 'Alguien tomó ese usuario mientras te registrabas. Elige otro.'
    : 'No pudimos crear tu perfil. Intenta de nuevo.';
}

type UsernameStepProps = {
  username: string;
  onChangeUsername: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  errorMessage: string | null;
};

// Se muestra solo si el correo ya se verificó pero no se pudo crear el
// perfil (ej. alguien tomó el usuario mientras tanto). El código ya se usó,
// así que el reintento va con la sesión que dejó la verificación.
export function UsernameStep({
  username,
  onChangeUsername,
  onSubmit,
  submitting,
  errorMessage,
}: UsernameStepProps) {
  const usernameAvailability = useUsernameAvailability(username);

  return (
    <View style={styles.container}>
      <View style={styles.headingGroup}>
        <ThemedText type="title" style={styles.title}>
          Elige tu usuario
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Tu correo ya quedó verificado. Solo falta el nombre con el que te van a ver los demás.
        </ThemedText>
      </View>

      <UsernameField value={username} onChangeText={onChangeUsername} availability={usernameAvailability} />

      {errorMessage && <Callout variant="warning">{errorMessage}</Callout>}

      <View style={styles.footer}>
        <Button
          title="Crear mi perfil"
          disabled={usernameAvailability.status !== 'available'}
          loading={submitting}
          onPress={onSubmit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.five,
  },
  headingGroup: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: Spacing.three,
  },
});
