import type { CommunityView } from '@utalk/shared';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { toggleMembership } from '@/hooks/mutations';
import { useTheme } from '@/hooks/useTheme';

// "Unirse" (relleno) / "Te uniste" (con borde), como en Reddit. Cambia al
// instante; lo que se manda al servidor es el estado final, cuando se deja de
// tocar (ver toggleMembership).
export function JoinButton({ community }: { community: CommunityView }) {
  const theme = useTheme();
  const joined = community.joinedByMe;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={joined ? `Salirse de c/${community.slug}` : `Unirse a c/${community.slug}`}
      accessibilityState={{ selected: joined }}
      onPress={() => toggleMembership(community)}
      hitSlop={6}
      style={[
        styles.button,
        joined
          ? { borderColor: theme.border, backgroundColor: 'transparent' }
          : { borderColor: theme.primary, backgroundColor: theme.primary },
      ]}>
      <ThemedText type="smallBold" themeColor={joined ? 'text' : 'onPrimary'}>
        {joined ? 'Te uniste' : 'Unirse'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
  },
});
