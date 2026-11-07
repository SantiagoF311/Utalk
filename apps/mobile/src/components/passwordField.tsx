import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, TextInputProps } from 'react-native';

import { TextField } from '@/components/textField';
import { useTheme } from '@/hooks/useTheme';

type PasswordFieldProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label?: string;
};

export function PasswordField({ label = 'Contraseña', ...inputProps }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const theme = useTheme();

  return (
    <TextField
      label={label}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      trailingIcon={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onPress={() => setVisible((current) => !current)}
          hitSlop={8}>
          <SymbolView
            tintColor={theme.textSecondary}
            name={{ ios: visible ? 'eye.slash' : 'eye', android: visible ? 'visibility_off' : 'visibility', web: visible ? 'visibility_off' : 'visibility' }}
            size={20}
          />
        </Pressable>
      }
      {...inputProps}
    />
  );
}
