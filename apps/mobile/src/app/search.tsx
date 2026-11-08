import { useLocalSearchParams } from 'expo-router';

import { SearchScreen } from '@/screens/search';

// Desde Inicio, `panelId` (el elegido en el sidebar); desde el 🔍 de una
// comunidad, `communityId` (se busca solo en ella, con opción de quitarlo).
export default function Search() {
  const { panelId, communityId } = useLocalSearchParams<{ panelId?: string; communityId?: string }>();
  return <SearchScreen panelId={panelId} communityId={communityId} />;
}
