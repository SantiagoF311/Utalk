import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ProfileHeader } from '@/components/profileHeader';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/queries';
import { errorMessage } from '@/lib/errorMessages';

// Perfil público de otra persona (al tocar su apodo en un post o
// comentario): apodo, universidad y desde cuándo está. Sus publicaciones y
// seguirla llegan después.
export function UserScreen({ userId }: { userId: string }) {
  const profile = useProfile(userId);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: profile.data ? `u/${profile.data.username}` : '' }} />
      {profile.isPending ? (
        <StateMessage kind="loading" />
      ) : profile.isError ? (
        <StateMessage
          kind="error"
          message={errorMessage(profile.error)}
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <View style={styles.content}>
          <ProfileHeader
            username={profile.data.username}
            universityName={profile.data.university.name}
            createdAt={profile.data.createdAt}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Sus publicaciones y comentarios van a aparecer acá.
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
