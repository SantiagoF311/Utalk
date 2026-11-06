import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';

// Primera pantalla sin sesión: presenta la app antes de pedir datos.
export function WelcomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <ThemedText type="subtitle" style={styles.center}>
          UTalk
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Entra con tu correo de la U para ver lo que se habla en tu universidad y en las demás.
        </ThemedText>
        <Button title="Iniciar sesión" onPress={() => router.push('/login')} style={styles.button} />
        <Button title="Crear cuenta" variant="ghost" onPress={() => router.push('/register')} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  center: {
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.three,
  },
});
