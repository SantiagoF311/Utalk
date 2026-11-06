import { router, Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { PasswordField } from '@/components/passwordField';
import { TextField } from '@/components/textField';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { api, ApiError } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export function LoginScreen() {
  const theme = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    setSubmitting(true);
    setLoginError(null);

    try {
      const session = await api.login(identifier.trim(), password);
      const { error } = await supabase.auth.setSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      });
      if (error) throw error;
      router.back();
    } catch (error) {
      setLoginError(
        error instanceof ApiError && error.code === 'INVALID_CREDENTIALS'
          ? 'Usuario o contraseña incorrectos.'
          : 'No pudimos iniciar sesión. Intenta de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  };

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
              Entra con tu correo de la U o tu usuario.
            </ThemedText>
          </View>

          <View style={styles.fieldsGroup}>
            <TextField
              label="Correo o usuario"
              value={identifier}
              onChangeText={(value) => {
                setIdentifier(value);
                setLoginError(null);
              }}
              placeholder="juan.perez@correounivalle.edu.co o juan_perez"
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
            <Button title="Entrar" onPress={handleLogin} loading={submitting} />
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
