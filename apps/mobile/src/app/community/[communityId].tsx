import type { PostSort } from '@utalk/shared';
import { useLocalSearchParams } from 'expo-router';

import { CommunityScreen } from '@/screens/community';

// `sort` opcional: el orden con el que abrir (ej. "Nuevo en c/…").
export default function Community() {
  const { communityId, sort } = useLocalSearchParams<{ communityId: string; sort?: PostSort }>();
  return <CommunityScreen communityId={communityId} sort={sort} />;
}
