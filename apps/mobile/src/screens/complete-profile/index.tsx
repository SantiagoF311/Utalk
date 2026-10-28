import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { getCompleteRegistrationErrorMessage, UsernameStep } from '@/screens/register/username-step';

// Para quien tiene sesión pero no perfil: verificó el correo y cerró la app
// antes de elegir usuario. Ver useRequireProfile.
export function CompleteProfileScreen() {
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await api.completeRegistration(username.trim());
      router.replace('/');
    } catch (error) {
      setErrorMessage(getCompleteRegistrationErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <UsernameStep
            username={username}
            onChangeUsername={setUsername}
            onSubmit={handleSubmit}
            submitting={submitting}
            errorMessage={errorMessage}
          />
          <Button title="Usar otra cuenta" variant="ghost" onPress={handleSignOut} />
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
    paddingBottom: Spacing.three,
  },
});
