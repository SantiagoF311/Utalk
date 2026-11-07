import type { VoteValue } from '@utalk/shared';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type VoteBarProps = {
  score: number;
  myVote: VoteValue | null;
  // En el feed va en una pastilla con borde; en los comentarios, suelta.
  bordered?: boolean;
};

// ↑ puntaje ↓, con tu voto resaltado. Solo muestra: votar llega con la rama
// de interacción.
export function VoteBar({ score, myVote, bordered = true }: VoteBarProps) {
  const theme = useTheme();
  const scoreColor = myVote === 1 ? 'success' : myVote === -1 ? 'primary' : 'text';

  return (
    <View
      style={[
        styles.container,
        bordered && [styles.bordered, { borderColor: theme.border }],
        bordered && myVote === 1 && { backgroundColor: theme.backgroundElement },
      ]}>
      <Icon name="upvote" size={16} color={myVote === 1 ? 'success' : 'textSecondary'} />
      <ThemedText type="smallBold" themeColor={scoreColor}>
        {score}
      </ThemedText>
      <Icon name="downvote" size={16} color={myVote === -1 ? 'primary' : 'textSecondary'} />
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
});
