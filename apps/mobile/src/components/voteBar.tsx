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
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={myVote === 1 ? 'Quitar voto positivo' : 'Votar a favor'}
        accessibilityState={{ selected: myVote === 1 }}
        onPress={() => onVote(1)}
        hitSlop={8}>
        <Icon name="upvote" size={14} color={myVote === 1 ? 'success' : 'textSecondary'} />
      </Pressable>
      <ThemedText type="smallBold" themeColor={scoreColor} style={styles.score}>
        {score}
      </ThemedText>
      {/* En la pastilla, una línea separa el voto a favor del voto en contra (como Reddit). */}
      {bordered && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={myVote === -1 ? 'Quitar voto negativo' : 'Votar en contra'}
        accessibilityState={{ selected: myVote === -1 }}
        onPress={() => onVote(-1)}
        hitSlop={8}>
        <Icon name="downvote" size={14} color={myVote === -1 ? 'primary' : 'textSecondary'} />
      </Pressable>
    </View>
  );
}

// Compacto, como el de Reddit. Las flechas se ven chicas, pero su zona de
// toque es más grande (hitSlop).
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  bordered: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.half,
  },
  score: {
    minWidth: 14,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
  },
});
