import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ProfileView } from '@/components/profileView';
import { StateMessage } from '@/components/stateMessage';
import { ThemedView } from '@/components/themedView';
import { Spacing } from '@/constants/theme';
import { useMyProfile } from '@/hooks/queries';
import { errorMessage } from '@/lib/errorMessages';

// Tu perfil (pestaña Perfil): lo mismo que ven los demás, más el acceso a
// Ajustes (cuenta, apodo, privacidad, tema). Aunque sea privado, tú ves todo.
export function ProfileScreen() {
  const me = useMyProfile();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ProfileBar />
        {me.isPending ? (
          <StateMessage kind="loading" />
        ) : me.isError ? (
          <StateMessage kind="error" message={errorMessage(me.error)} onRetry={() => void me.refetch()} />
        ) : (
          <ProfileView userId={me.data.id} isOwn />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

// La barra del perfil es distinta a la del resto de pestañas: sin ☰ ni
// título (el apodo ya está abajo), solo el acceso a Ajustes.
function ProfileBar() {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajustes"
        onPress={() => router.push('/settings')}
        hitSlop={8}>
        <Icon name="settings" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    minHeight: 52,
  },
});
