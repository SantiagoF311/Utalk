import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ReactNode } from 'react';

import { AnimatedSplashOverlay } from '@/components/animatedIcon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireProfile } from '@/hooks/useRequireProfile';
import { SessionProvider, useSession } from '@/hooks/useSession';
import { ThemePreferenceProvider } from '@/hooks/useThemePreference';
import { queryClient } from '@/lib/queryClient';

SplashScreen.preventAutoHideAsync();

// Las cabeceras de navegación (post, comunidad, ajustes…) con nuestra paleta
// en vez de los grises por defecto de React Navigation.
const NAVIGATION_THEMES = {
  light: withPalette(DefaultTheme, Colors.light),
  dark: withPalette(DarkTheme, Colors.dark),
};

function withPalette(base: typeof DefaultTheme, palette: (typeof Colors)['light' | 'dark']) {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.border,
    },
  };
}

// Los proveedores van afuera y la navegación adentro: RootNavigator lee la
// sesión del contexto, que tiene que existir antes.
export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationTheme>
            <RootNavigator />
          </NavigationTheme>
        </QueryClientProvider>
      </SessionProvider>
    </ThemePreferenceProvider>
  );
}

// Aparte de RootLayout porque lee el tema elegido, que viene del proveedor.
function NavigationTheme({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={NAVIGATION_THEMES[colorScheme === 'dark' ? 'dark' : 'light']}>
      {children}
    </ThemeProvider>
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
          importa: sin sesión es `welcome`, con sesión `(drawer)`. */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="login" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(drawer)" />
          {/* Sin cabecera nativa: la comunidad dibuja su propia barra (como Reddit). */}
          <Stack.Screen name="community/[communityId]" />
          {/* El título lo pone cada pantalla cuando carga el nombre. */}
          <Stack.Screen
            name="post/[postId]"
            options={{ headerShown: true, title: 'Publicación', headerBackTitle: 'Atrás' }}
          />
          <Stack.Screen
            name="user/[userId]"
            options={{ headerShown: true, title: '', headerBackTitle: 'Atrás' }}
          />
          <Stack.Screen
            name="settings"
            options={{ headerShown: true, title: 'Ajustes', headerBackTitle: 'Atrás' }}
          />
          <Stack.Screen
            name="change-username"
            options={{ headerShown: true, title: 'Cambiar apodo', headerBackTitle: 'Atrás' }}
          />
          <Stack.Screen
            name="my-reports"
            options={{ headerShown: true, title: 'Mis reportes', headerBackTitle: 'Atrás' }}
          />
          <Stack.Screen
            name="moderation"
            options={{ headerShown: true, title: 'Moderación', headerBackTitle: 'Atrás' }}
          />
          <Stack.Screen name="search" />
          <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
          <Stack.Screen name="create-community" options={{ presentation: 'modal' }} />
          <Stack.Screen name="report" options={{ presentation: 'modal' }} />
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
