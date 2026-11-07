import { Drawer } from 'expo-router/drawer';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Sidebar } from '@/components/sidebar';
import { FeedSelectionProvider } from '@/hooks/useFeedSelection';
import { useTheme } from '@/hooks/useTheme';

// El sidebar (como el de Reddit) envuelve las pestañas: se abre con el botón
// ☰ de Inicio y Comunidades, o deslizando desde el borde izquierdo.
export default function DrawerLayout() {
  const theme = useTheme();

  return (
    // El gesto de deslizar para abrir el sidebar necesita GestureHandlerRootView.
    <GestureHandlerRootView style={styles.container}>
      <FeedSelectionProvider>
        <Drawer
          drawerContent={(props) => <Sidebar {...props} />}
          screenOptions={{
            headerShown: false,
            drawerStyle: { backgroundColor: theme.background, width: 300 },
          }}>
          <Drawer.Screen name="(tabs)" />
        </Drawer>
      </FeedSelectionProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
