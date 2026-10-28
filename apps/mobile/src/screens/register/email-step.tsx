import { emailSchema } from '@utalk/shared';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { PasswordField } from '@/components/password-field';
import { PasswordStrengthMeter } from '@/components/password-strength-meter';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { UsernameField } from '@/screens/register/username-field';
import { useUniversityDomainCheck } from '@/screens/register/use-university-domain-check';
import { useUsernameAvailability } from '@/screens/register/use-username-availability';

type EmailStepProps = {
  email: string;
  username: string;
  password: string;
  onChangeEmail: (value: string) => void;
  onChangeUsername: (value: string) => void;
  onChangePassword: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  errorMessage: string | null;
};

export function EmailStep({
  email,
  username,
  password,
  onChangeEmail,
  onChangeUsername,
  onChangePassword,
  onSubmit,
  submitting,
  errorMessage,
}: EmailStepProps) {
  const theme = useTheme();
  const isEmailValid = emailSchema.safeParse(email).success;
  const domainCheck = useUniversityDomainCheck(email, isEmailValid);
  const usernameAvailability = useUsernameAvailability(username);
  // Sin un usuario disponible no se manda el código: si el usuario falla
  // después de verificar, la cuenta queda creada sin perfil.
  const canSubmit =
    domainCheck.status === 'registered' && usernameAvailability.status === 'available' && password.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.headingGroup}>
        <ThemedText type="title" style={styles.title}>
          Entra con tu correo de la U
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Lo usamos solo para saber que eres estudiante. Nadie más lo ve, ni siquiera en tu perfil.
        </ThemedText>
      </View>

      <View style={styles.fieldsGroup}>
        <View style={styles.fieldWithHint}>
          <TextField
            label="Correo institucional"
            value={email}
            onChangeText={onChangeEmail}
            placeholder="juan.perez@correounivalle.edu.co"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            trailingIcon={
              domainCheck.status === 'registered' ? (
                <SymbolView
                  tintColor={theme.success}
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }}
                  size={20}
                />
              ) : domainCheck.status === 'unregistered' ? (
                <SymbolView
                  tintColor={theme.warning}
                  name={{ ios: 'xmark.circle.fill', android: 'cancel' }}
                  size={20}
                />
              ) : undefined
            }
          />
          {domainCheck.status === 'registered' && (
            <View style={[styles.universityBadge, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                tintColor={theme.textSecondary}
                name={{ ios: 'graduationcap.fill', android: 'school' }}
                size={14}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {domainCheck.universityName}
              </ThemedText>
            </View>
          )}
          {domainCheck.status === 'unregistered' && (
            <ThemedText type="small" themeColor="warning">
              Ese dominio no está entre las universidades registradas todavía.
            </ThemedText>
          )}
        </View>

        <UsernameField value={username} onChangeText={onChangeUsername} availability={usernameAvailability} />

        <View style={styles.fieldWithHint}>
          <PasswordField value={password} onChangeText={onChangePassword} placeholder="••••••••" />
          <PasswordStrengthMeter password={password} />
          <ThemedText type="small" themeColor="textSecondary">
            Mínimo 8 caracteres, con un número.
          </ThemedText>
        </View>
      </View>

      {errorMessage && <Callout variant="warning">{errorMessage}</Callout>}

      <Callout>
        ¿Tu universidad no aparece? Solo aceptamos dominios que ya tenemos registrados.{' '}
        <ThemedText type="small" themeColor="primary">
          Pide que la agreguemos.
        </ThemedText>
      </Callout>

      <View style={styles.footer}>
        <Button title="Enviarme el código" disabled={!canSubmit} onPress={onSubmit} loading={submitting} />
        <View style={styles.loginRow}>
          <ThemedText themeColor="textSecondary">¿Ya tienes cuenta? </ThemedText>
          <Link href="/login">
            <ThemedText themeColor="primary">Inicia sesión</ThemedText>
          </Link>
        </View>
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
  fieldsGroup: {
    gap: Spacing.four,
  },
  fieldWithHint: {
    gap: Spacing.two,
  },
  universityBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.four,
  },
  footer: {
    marginTop: 'auto',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
