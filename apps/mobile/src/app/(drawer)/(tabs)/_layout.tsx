import { Tabs } from 'expo-router';

import { TabBar } from '@/components/tabBar';

// Las pantallas van en el orden en que Expo Router arma el estado inicial
// (`index` primero, después por largo del nombre). Si el orden declarado no
// coincide, al montar despacha ROUTE_NAMES_CHANGED y avisa que nadie lo
// manejó. El orden visual lo decide TabBar.
export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
      <Tabs.Screen name="communities" options={{ title: 'Comunidades' }} />
    </Tabs>
  );
}
