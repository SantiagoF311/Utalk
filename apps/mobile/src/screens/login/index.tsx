import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { PasswordField } from '@/components/password-field';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SymbolView
            tintColor={theme.primary}
            name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum' }}
            size={32}
          />

          <View style={styles.headingGroup}>
            <ThemedText type="title" style={styles.title}>
              Qué bueno verte
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Entra con el correo de la U con el que te registraste.
            </ThemedText>
          </View>

          <View style={styles.fieldsGroup}>
            <TextField
              label="Correo institucional"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setLoginError(null);
              }}
              placeholder="juan.perez@correounivalle.edu.co"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.fieldWithHint}>
              <PasswordField
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setLoginError(null);
                }}
                placeholder="••••••••"
              />
              {loginError && (
                <Callout variant="warning">
                  {loginError}{' '}
                  <ThemedText type="small" themeColor="primary">
                    Olvidé mi contraseña
                  </ThemedText>
                </Callout>
              )}
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <ThemedText type="smallBold">Mantener la sesión abierta</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Mejor no en los computadores de la biblioteca.
                </ThemedText>
              </View>
              <Switch
                value={keepSignedIn}
                onValueChange={setKeepSignedIn}
                trackColor={{ true: theme.primary }}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Button title="Entrar" onPress={() => setLoginError(null)} />
            <View style={styles.registerRow}>
              <ThemedText themeColor="textSecondary">¿Primera vez aquí? </ThemedText>
              <Link href="/register">
                <ThemedText themeColor="primary">Crea tu cuenta</ThemedText>
              </Link>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
  content: {
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  switchLabel: {
    flex: 1,
    gap: Spacing.half,
  },
  footer: {
    marginTop: 'auto',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
