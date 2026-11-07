import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

type ProfileHeaderProps = {
  username: string;
  universityName: string | undefined;
  createdAt: string;
};

// Cabecera de un perfil (el tuyo o el de otro): iniciales, apodo,
// universidad y desde cuándo está.
export function ProfileHeader({ username, universityName, createdAt }: ProfileHeaderProps) {
  const theme = useTheme();
  const since = new Date(createdAt);

  return (
    <View style={styles.identity}>
      <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
        <ThemedText themeColor="primary" style={styles.avatarText}>
          {username.slice(0, 2).toLowerCase()}
        </ThemedText>
      </View>
      <View style={styles.identityText}>
        <ThemedText style={styles.username}>u/{username}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {universityName ? `${universityName} · ` : ''}desde {MONTHS[since.getMonth()]} de{' '}
          {since.getFullYear()}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
  },
  identityText: {
    flex: 1,
    gap: Spacing.half,
  },
  username: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
  },
});
