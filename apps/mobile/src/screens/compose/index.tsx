import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { StateMessage } from '@/components/stateMessage';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';

// Publicar llega con la rama de interacción; por ahora el botón ✏️ de la
// barra abre esto.
export function ComposeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <StateMessage
            kind="empty"
            title="Publicar llega pronto"
            description="Vas a poder escribir en tu universidad o en el panel general, con tu apodo."
          />
          <Button title="Volver" variant="ghost" onPress={() => router.back()} />
        </View>
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
    padding: Spacing.four,
  },
});
