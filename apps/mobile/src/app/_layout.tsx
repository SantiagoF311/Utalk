import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animatedIcon';
import { useRequireProfile } from '@/hooks/useRequireProfile';
import { SessionProvider, useSession } from '@/hooks/useSession';
import { queryClient } from '@/lib/queryClient';

SplashScreen.preventAutoHideAsync();

// Los proveedores van afuera y la navegación adentro: RootNavigator lee la
// sesión del contexto, que tiene que existir antes.
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

function RootNavigator() {
  const session = useSession();
  useRequireProfile();

  const signedIn = !!session;

  return (
    <>
      {/* La pantalla de carga nativa se oculta recién cuando se sabe si hay
          sesión: así no se ve un instante la zona equivocada. */}
      {session !== undefined && <AnimatedSplashOverlay />}

      {/* Dos zonas (rutas protegidas de Expo Router): cada pantalla existe
          solo si su guard es true. Al iniciar o cerrar sesión, la app
          redirige sola a la primera pantalla disponible — por eso el orden
          importa: sin sesión es `welcome`, con sesión `(tabs)`. */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="login" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          {/* El título lo pone cada pantalla cuando carga el nombre. */}
          <Stack.Screen
            name="panel/[panelId]"
            options={{ headerShown: true, title: '', headerBackTitle: 'Atrás' }}
          />
          <Stack.Screen
            name="forum/[forumId]"
            options={{ headerShown: true, title: '', headerBackTitle: 'Atrás' }}
          />
          <Stack.Screen name="complete-profile" options={{ gestureEnabled: false }} />
        </Stack.Protected>

        {/* Fuera de las dos zonas: el registro cruza el momento en que
            aparece la sesión (después de verificar el código todavía falta
            elegir el apodo), y protegerlo lo cerraría a la mitad. */}
        <Stack.Screen name="register" />
      </Stack>
    </>
  );
}
