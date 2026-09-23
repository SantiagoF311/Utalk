import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type OtpCodeInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
};

export function OtpCodeInput({ value, onChangeText, length = 6 }: OtpCodeInputProps) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.row}>
      {Array.from({ length }).map((_, index) => {
        const isCursor = focused && index === value.length;
        return (
          <View
            key={index}
            style={[
              styles.box,
              { borderColor: isCursor ? theme.primary : theme.border, backgroundColor: theme.background },
            ]}>
            <ThemedText style={styles.digit}>{value[index] ?? ''}</ThemedText>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        style={[StyleSheet.absoluteFill, styles.hiddenInput]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  box: {
    width: 44,
    height: 52,
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: 20,
    fontWeight: '700',
  },
  hiddenInput: {
    opacity: 0,
  },
});
