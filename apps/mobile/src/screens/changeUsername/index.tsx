import { USERNAME_CHANGE_COOLDOWN_DAYS } from '@utalk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useUpdateMyProfile } from '@/hooks/mutations';
import { useMyProfile } from '@/hooks/queries';
import { errorMessage } from '@/lib/errorMessages';
import { UsernameField } from '@/screens/register/usernameField';
import { useUsernameAvailability } from '@/screens/register/useUsernameAvailability';

// Cambiar el apodo (desde Ajustes): una vez cada 30 días. Tus publicaciones
// pasan al nuevo. (El viejo queda reservado ese tiempo para que nadie se haga
// pasar por ti; eso lo hace el backend y no hace falta contarlo acá.)
export function ChangeUsernameScreen() {
  const me = useMyProfile();
  const updateProfile = useUpdateMyProfile();
  const [username, setUsername] = useState('');
  const availability = useUsernameAvailability(username);
  const isSame = username.trim() === me.data?.username;
  const canSave = availability.status === 'available' && !isSame;

  const save = () => {
    if (!canSave) return;
    updateProfile.mutate({ username: username.trim() }, { onSuccess: () => router.back() });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText themeColor="textSecondary">
              Ahora eres <ThemedText style={styles.bold}>u/{me.data?.username}</ThemedText>.
            </ThemedText>

            <UsernameField value={username} onChangeText={setUsername} availability={availability} />

            <Callout>
              Solo puedes cambiarlo una vez cada {USERNAME_CHANGE_COOLDOWN_DAYS} días.
            </Callout>
            <Callout>
              Evita tu nombre, tu carrera y tu semestre juntos. Tus publicaciones y comentarios pasan al
              apodo nuevo.
            </Callout>
            {updateProfile.isError && <Callout variant="warning">{errorMessage(updateProfile.error)}</Callout>}
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Cambiar apodo" disabled={!canSave} loading={updateProfile.isPending} onPress={save} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: Spacing.four,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  bold: {
    fontWeight: 700,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
});
