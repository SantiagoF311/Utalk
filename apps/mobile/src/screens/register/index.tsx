import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { CodeStep } from '@/screens/register/code-step';
import { EmailStep } from '@/screens/register/email-step';
import { StepHeader } from '@/screens/register/step-header';

type RegisterStep = 'email' | 'code';

export function RegisterScreen() {
  const [step, setStep] = useState<RegisterStep>('email');
  const [email, setEmail] = useState('');
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
    setSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }
    router.back();
  };

  const handleResendCode = async () => {
    await supabase.auth.resend({ type: 'signup', email });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StepHeader
          step={step === 'email' ? 1 : 2}
          onBack={() => {
            setErrorMessage(null);
            if (step === 'email') {
              router.back();
            } else {
              setStep('email');
            }
          }}
        />
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {step === 'email' ? (
            <EmailStep
              email={email}
              password={password}
              onChangeEmail={setEmail}
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
