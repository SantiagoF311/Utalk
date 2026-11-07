import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ProfileHeader } from '@/components/profileHeader';
import { SegmentedControl } from '@/components/segmentedControl';
import { StateMessage } from '@/components/stateMessage';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useMyProfile } from '@/hooks/queries';
import { useFeedSelection } from '@/hooks/useFeedSelection';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';

type ProfileTab = 'posts' | 'comments';

const TABS: { value: ProfileTab; label: string }[] = [
  { value: 'posts', label: 'Publicaciones' },
  { value: 'comments', label: 'Comentarios' },
];

// Tu perfil: apodo, universidad y, cuando la API lo permita, tus
// publicaciones y comentarios. La cuenta y cerrar sesión están en Ajustes.
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
          <ProfileContent username={me.data.username} createdAt={me.data.createdAt} />
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

function ProfileContent({ username, createdAt }: { username: string; createdAt: string }) {
  const theme = useTheme();
  const { panels, myPanelId } = useFeedSelection();
  const [tab, setTab] = useState<ProfileTab>('posts');
  const universityName = panels.find((panel) => panel.id === myPanelId)?.name;

  return (
    <View style={styles.content}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <ProfileHeader username={username} universityName={universityName} createdAt={createdAt} />
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </View>

      {/* La API todavía no filtra publicaciones ni comentarios por autor. */}
      <StateMessage
        kind="empty"
        title={tab === 'posts' ? 'Tus publicaciones llegan pronto' : 'Tus comentarios llegan pronto'}
        description="Vas a poder verlos acá, con sus votos."
      />
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
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
