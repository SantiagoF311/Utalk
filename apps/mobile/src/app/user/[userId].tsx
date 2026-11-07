import { useLocalSearchParams } from 'expo-router';

import { UserScreen } from '@/screens/user';

export default function User() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <UserScreen userId={userId} />;
}
