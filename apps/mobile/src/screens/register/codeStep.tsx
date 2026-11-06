import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { OtpCodeInput } from '@/components/otpCodeInput';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

type CodeStepProps = {
  email: string;
  code: string;
  onChangeCode: (value: string) => void;
  onSubmit: () => void;
  onResend: () => void;
  onChangeEmailRequested: () => void;
  submitting: boolean;
  errorMessage: string | null;
};

export function CodeStep({
  email,
  code,
  onChangeCode,
  onSubmit,
  onResend,
  onChangeEmailRequested,
  submitting,
  errorMessage,
}: CodeStepProps) {
  const theme = useTheme();
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = setInterval(() => setSecondsLeft((current) => Math.max(current - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const canResend = secondsLeft === 0;

  return (
    <View style={styles.container}>
      <View style={styles.headingGroup}>
        <ThemedText type="title" style={styles.title}>
          Revisa tu correo
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Te mandamos un código de seis dígitos a{' '}
          <ThemedText type="smallBold" themeColor="text">
            {email}
          </ThemedText>
          . Suele llegar en menos de un minuto.
        </ThemedText>
      </View>

      <View style={styles.fieldsGroup}>
        <OtpCodeInput value={code} onChangeText={onChangeCode} length={CODE_LENGTH} />

        <View style={styles.countdownRow}>
          <SymbolView tintColor={theme.textSecondary} name={{ ios: 'clock', android: 'schedule' }} size={14} />
          <ThemedText type="small" themeColor="textSecondary">
            {canResend ? 'Ya puedes pedir otro código' : `Puedes pedir otro en ${formatCountdown(secondsLeft)}`}
          </ThemedText>
        </View>
      </View>

      {errorMessage && <Callout variant="warning">{errorMessage}</Callout>}

      <Callout>
        ¿No llega? Los correos de la U a veces lo mandan a spam o a «Otros». También puedes{' '}
        <ThemedText type="small" themeColor="primary" onPress={onChangeEmailRequested}>
          cambiar el correo.
        </ThemedText>
      </Callout>

      <View style={styles.footer}>
        <Button
          title="Verificar"
          disabled={code.length < CODE_LENGTH}
          loading={submitting}
          onPress={onSubmit}
        />
        <Pressable
          disabled={!canResend}
          onPress={() => {
            setSecondsLeft(RESEND_SECONDS);
            onResend();
          }}
          style={styles.resendRow}
          hitSlop={8}>
          <ThemedText themeColor={canResend ? 'primary' : 'textSecondary'} style={!canResend && styles.disabledText}>
            Reenviar código
          </ThemedText>
        </Pressable>
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
    gap: Spacing.three,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  footer: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  resendRow: {
    alignItems: 'center',
  },
  disabledText: {
    opacity: 0.5,
  },
});
