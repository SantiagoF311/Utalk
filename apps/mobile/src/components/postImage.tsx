import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

// En el feed todas las imágenes ocupan lo mismo (recortadas), para que la
// lista no salte mientras cargan. En el detalle se ve entera, con su
// proporción real, dentro de un rango para que una foto muy alta o muy
// ancha no se coma la pantalla.
const FEED_ASPECT_RATIO = 4 / 3;
const MIN_ASPECT_RATIO = 0.6;
const MAX_ASPECT_RATIO = 2;

export function PostImage({ uri, full = false }: { uri: string; full?: boolean }) {
  const theme = useTheme();
  const [aspectRatio, setAspectRatio] = useState(FEED_ASPECT_RATIO);

  return (
    <Image
      source={{ uri }}
      accessible
      accessibilityLabel="Imagen de la publicación"
      contentFit={full ? 'contain' : 'cover'}
      transition={150}
      onLoad={
        full
          ? ({ source }) =>
              setAspectRatio(
                Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, source.width / source.height)),
              )
          : undefined
      }
      style={[styles.image, { aspectRatio, backgroundColor: theme.backgroundElement }]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    borderRadius: 10,
  },
});
