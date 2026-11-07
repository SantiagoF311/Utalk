import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';

// Marca provisional de UTalk (dos globos de conversación encimados, como en
// el diseño) hasta que exista un logo de verdad.
export function Logo({ size = 40 }: { size?: number }) {
  const bubble = Math.round(size * 0.75);

  return (
    <View style={{ width: size, height: size }} accessibilityLabel="UTalk" accessibilityRole="image">
      <View style={styles.back}>
        <Icon name="bubble" size={bubble} color="primary" />
      </View>
      <View style={styles.front}>
        <Icon name="bubble" size={bubble} color="text" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  front: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
});
