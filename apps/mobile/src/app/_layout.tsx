import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animatedIcon';
import { useRequireProfile } from '@/hooks/useRequireProfile';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useRequireProfile();

  // Al cerrar sesión se vacía la caché: si entra otra cuenta en el mismo
  // dispositivo, no puede ver datos (ej. "mi voto") de la anterior.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="complete-profile" options={{ gestureEnabled: false }} />
          {/* El título lo pone cada pantalla cuando carga el nombre. */}
          <Stack.Screen
            name="panel/[panelId]"
            options={{ headerShown: true, title: '', headerBackTitle: 'Atrás' }}
          />
          <Stack.Screen
            name="forum/[forumId]"
            options={{ headerShown: true, title: '', headerBackTitle: 'Atrás' }}
          />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
