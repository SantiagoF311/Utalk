import { useLocalSearchParams } from 'expo-router';

import { NewChatScreen } from '@/screens/newChat';

// /chat/new?userId=…&username=… (desde el perfil de alguien).
export default function NewChat() {
  const { userId, username } = useLocalSearchParams<{ userId: string; username: string }>();
  return <NewChatScreen userId={userId} username={username} />;
}
