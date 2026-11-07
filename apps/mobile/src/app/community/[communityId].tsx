import { useLocalSearchParams } from 'expo-router';

import { CommunityScreen } from '@/screens/community';

export default function Community() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  return <CommunityScreen communityId={communityId} />;
}
