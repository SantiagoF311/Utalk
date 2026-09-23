import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { CodeStep } from '@/screens/register/code-step';
import { EmailStep } from '@/screens/register/email-step';
import { StepHeader } from '@/screens/register/step-header';

type RegisterStep = 'email' | 'code';

export function RegisterScreen() {
  const [step, setStep] = useState<RegisterStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StepHeader
          step={step === 'email' ? 1 : 2}
          onBack={() => (step === 'email' ? router.back() : setStep('email'))}
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
              onSubmit={() => setStep('code')}
            />
          ) : (
            <CodeStep
              email={email}
              code={code}
              onChangeCode={setCode}
              onSubmit={() => router.back()}
              onChangeEmailRequested={() => setStep('email')}
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
