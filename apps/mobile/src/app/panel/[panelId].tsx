import { useLocalSearchParams } from 'expo-router';

import { PanelScreen } from '@/screens/panel';

export default function Panel() {
  const { panelId } = useLocalSearchParams<{ panelId: string }>();
  return <PanelScreen panelId={panelId} />;
}
