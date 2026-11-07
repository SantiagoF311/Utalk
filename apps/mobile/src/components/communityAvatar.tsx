import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themedText';
import { useTheme } from '@/hooks/useTheme';

// Las comunidades todavía no tienen imagen: un círculo con su inicial.
export function CommunityAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.primarySoft },
      ]}>
      <ThemedText
        type="smallBold"
        themeColor="primary"
        style={{ fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.6) }}>
        {name.charAt(0).toUpperCase()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
