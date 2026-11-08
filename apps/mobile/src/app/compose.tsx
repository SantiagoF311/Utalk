import { useLocalSearchParams } from 'expo-router';

import { ComposeScreen } from '@/screens/compose';

// `communityId` opcional: si se abre desde una comunidad, viene elegida.
export default function Compose() {
  const { communityId } = useLocalSearchParams<{ communityId?: string }>();
  return <ComposeScreen communityId={communityId} />;
}
