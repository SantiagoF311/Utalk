import { useLocalSearchParams } from 'expo-router';

import { ConversationScreen } from '@/screens/conversation';

export default function Conversation() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  return <ConversationScreen conversationId={conversationId} />;
}
