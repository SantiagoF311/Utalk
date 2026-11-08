import { useLocalSearchParams } from 'expo-router';

import { CreateCommunityScreen } from '@/screens/createCommunity';

// `panelId`: el panel elegido en el sidebar, si es uno donde se puede crear.
export default function CreateCommunity() {
  const { panelId } = useLocalSearchParams<{ panelId?: string }>();
  return <CreateCommunityScreen panelId={panelId} />;
}
