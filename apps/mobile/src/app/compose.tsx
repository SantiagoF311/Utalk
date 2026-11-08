import { useLocalSearchParams } from 'expo-router';

import { ComposeScreen } from '@/screens/compose';

// Opcionales: `communityId` si se abre desde una comunidad (viene elegida) y
// `title` si se abre desde una búsqueda sin resultados.
export default function Compose() {
  const { communityId, title } = useLocalSearchParams<{ communityId?: string; title?: string }>();
  return <ComposeScreen communityId={communityId} title={title} />;
}
