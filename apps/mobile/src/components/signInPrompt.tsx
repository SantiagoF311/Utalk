import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';

// Para pantallas que necesitan sesión (toda la API la requiere).
export function SignInPrompt() {
  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.center}>
        UTalk
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        Entra con tu correo de la U para ver lo que se habla en tu universidad y en las demás.
      </ThemedText>
      <Button title="Iniciar sesión" onPress={() => router.push('/login')} style={styles.button} />
      <Button title="Crear cuenta" variant="ghost" onPress={() => router.push('/register')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  center: {
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.three,
  },
});
