import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { CodeStep } from '@/screens/register/codeStep';
import { EmailStep } from '@/screens/register/emailStep';
import { StepHeader } from '@/screens/register/stepHeader';
import { getCompleteRegistrationErrorMessage, UsernameStep } from '@/screens/register/usernameStep';

type RegisterStep = 'email' | 'code' | 'username';

const STEP_NUMBERS: Record<RegisterStep, number> = { email: 1, code: 2, username: 3 };

export function RegisterScreen() {
  const [step, setStep] = useState<RegisterStep>('email');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleEmailSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setStep('code');
  };

  const handleCodeSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });

    if (error) {
      setSubmitting(false);
      setErrorMessage(error.message);
      return;
    }

    await completeRegistration();
  };

  // Usa la sesión que dejó verifyOtp. Si falla, el código ya no sirve para
  // reintentar, así que se pasa al paso de usuario en vez de quedarse en el
  // de código.
  const completeRegistration = async () => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await api.completeRegistration(username.trim());
      // A Inicio. No `back()`: la bienvenida de la que vino ya no existe con
      // sesión (es de la zona sin sesión del layout raíz).
      router.replace('/');
    } catch (error) {
      setStep('username');
      setErrorMessage(getCompleteRegistrationErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    await supabase.auth.resend({ type: 'signup', email });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StepHeader
          step={STEP_NUMBERS[step]}
          onBack={() => {
            setErrorMessage(null);
            if (step === 'code') {
              setStep('email');
            } else {
              router.back();
            }
          }}
        />
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {step === 'username' ? (
            <UsernameStep
              username={username}
              onChangeUsername={setUsername}
              onSubmit={completeRegistration}
              submitting={submitting}
              errorMessage={errorMessage}
            />
          ) : step === 'email' ? (
            <EmailStep
              email={email}
              username={username}
              password={password}
              onChangeEmail={setEmail}
              onChangeUsername={setUsername}
              onChangePassword={setPassword}
              onSubmit={handleEmailSubmit}
              submitting={submitting}
              errorMessage={errorMessage}
            />
          ) : (
            <CodeStep
              email={email}
              code={code}
              onChangeCode={setCode}
              onSubmit={handleCodeSubmit}
              onResend={handleResendCode}
              onChangeEmailRequested={() => {
                setErrorMessage(null);
                setStep('email');
              }}
              submitting={submitting}
              errorMessage={errorMessage}
            />
          )}
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
    paddingTop: Spacing.three,
    gap: Spacing.five,
  },
  content: {
    flex: 1,
  },
});
