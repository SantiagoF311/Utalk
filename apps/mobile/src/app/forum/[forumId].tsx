import { useLocalSearchParams } from 'expo-router';

import { ForumScreen } from '@/screens/forum';

export default function Forum() {
  const { forumId } = useLocalSearchParams<{ forumId: string }>();
  return <ForumScreen forumId={forumId} />;
}
