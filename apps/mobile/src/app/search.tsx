import { useLocalSearchParams } from 'expo-router';

import { SearchScreen } from '@/screens/search';

// `panelId`: el panel desde el que se abrió (el elegido en el sidebar).
export default function Search() {
  const { panelId } = useLocalSearchParams<{ panelId?: string }>();
  return <SearchScreen panelId={panelId} />;
}
