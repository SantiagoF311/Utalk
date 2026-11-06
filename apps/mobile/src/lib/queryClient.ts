import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ApiError } from '@/lib/api';

// Caché de datos del servidor en el cliente (ver docs/mobile.md).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Durante 30 s los datos se consideran frescos: volver a una pantalla
      // los muestra al instante sin volver a pedirlos.
      staleTime: 30_000,
      // Reintentar solo fallas de red o del servidor: un 4xx (sin permiso,
      // no existe, validación) va a fallar igual la segunda vez.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

// En React Native no hay "foco de ventana": se usa el estado de la app, así
// los datos visibles se refrescan al volver a la app desde segundo plano.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}
