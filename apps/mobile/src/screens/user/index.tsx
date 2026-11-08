import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ProfileView } from '@/components/profileView';
import { ThemedView } from '@/components/themedView';
import { useProfile } from '@/hooks/queries';

// Perfil de otra persona (al tocar su apodo): sus publicaciones, comentarios y
// contadores, salvo que su perfil sea privado.
export function UserScreen({ userId }: { userId: string }) {
  const profile = useProfile(userId);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: profile.data ? `u/${profile.data.username}` : '' }} />
      <ProfileView userId={userId} isOwn={false} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
