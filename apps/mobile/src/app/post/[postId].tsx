import { useLocalSearchParams } from 'expo-router';

import { PostScreen } from '@/screens/post';

export default function Post() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return <PostScreen postId={postId} />;
}
