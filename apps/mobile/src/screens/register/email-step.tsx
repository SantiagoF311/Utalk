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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailStepProps = {
  email: string;
  password: string;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onSubmit: () => void;
};

export function EmailStep({ email, password, onChangeEmail, onChangePassword, onSubmit }: EmailStepProps) {
  const theme = useTheme();
  const isEmailValid = EMAIL_REGEX.test(email);

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
              isEmailValid ? (
                <SymbolView
                  tintColor={theme.success}
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }}
                  size={20}
                />
              ) : undefined
            }
          />
          {isEmailValid && (
            <View style={[styles.universityBadge, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                tintColor={theme.textSecondary}
                name={{ ios: 'graduationcap.fill', android: 'school' }}
                size={14}
              />
              <ThemedText type="small" themeColor="textSecondary">
                Universidad del Valle
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.fieldWithHint}>
          <PasswordField value={password} onChangeText={onChangePassword} placeholder="••••••••" />
          <PasswordStrengthMeter password={password} />
          <ThemedText type="small" themeColor="textSecondary">
            Mínimo 8 caracteres, con un número.
          </ThemedText>
        </View>
      </View>

      <Callout>
        ¿Tu universidad no aparece? Solo aceptamos dominios que ya tenemos registrados.{' '}
        <ThemedText type="small" themeColor="primary">
          Pide que la agreguemos.
        </ThemedText>
      </Callout>

      <View style={styles.footer}>
        <Button title="Enviarme el código" onPress={onSubmit} />
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
    justifyContent: 'space-between',
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
    gap: Spacing.three,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
