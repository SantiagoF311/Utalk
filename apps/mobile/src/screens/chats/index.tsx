import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screenHeader';
import { StateMessage } from '@/components/stateMessage';
import { ThemedView } from '@/components/themedView';

// Los chats todavía no existen en el backend: la pestaña queda reservada.
export function ChatsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Chats" />
        <StateMessage
          kind="empty"
          title="Los chats llegan pronto"
          description="Vas a poder escribirle a alguien desde su publicación, sin dejar de ser anónimo."
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
