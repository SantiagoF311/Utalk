import type { VoteValue } from '@utalk/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type VoteBarProps = {
  score: number;
  myVote: VoteValue | null;
  // Flecha tocada (1 = ↑, -1 = ↓). Quien la usa decide si pone, cambia o
  // quita el voto (ver nextVote en hooks/mutations.ts).
  onVote: (pressed: VoteValue) => void;
  // En el feed va en una pastilla con borde; en los comentarios, suelta.
  bordered?: boolean;
};

// ↑ puntaje ↓, con tu voto resaltado.
export function VoteBar({ score, myVote, onVote, bordered = true }: VoteBarProps) {
  const theme = useTheme();
  const scoreColor = myVote === 1 ? 'success' : myVote === -1 ? 'primary' : 'text';

  return (
    <View
      style={[
        styles.container,
        bordered && [styles.bordered, { borderColor: theme.border }],
        bordered && myVote !== null && { backgroundColor: theme.backgroundElement },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={myVote === 1 ? 'Quitar voto positivo' : 'Votar a favor'}
        accessibilityState={{ selected: myVote === 1 }}
        onPress={() => onVote(1)}
        hitSlop={8}>
        <Icon name="upvote" size={16} color={myVote === 1 ? 'success' : 'textSecondary'} />
      </Pressable>
      <ThemedText type="smallBold" themeColor={scoreColor} style={styles.score}>
        {score}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={myVote === -1 ? 'Quitar voto negativo' : 'Votar en contra'}
        accessibilityState={{ selected: myVote === -1 }}
        onPress={() => onVote(-1)}
        hitSlop={8}>
        <Icon name="downvote" size={16} color={myVote === -1 ? 'primary' : 'textSecondary'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bordered: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  score: {
    minWidth: 16,
    textAlign: 'center',
  },
});
