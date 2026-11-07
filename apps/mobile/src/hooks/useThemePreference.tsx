import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Appearance, Platform } from 'react-native';

import { deviceStorage, StorageKeys } from '@/lib/deviceStorage';

export type ThemePreference = 'system' | 'light' | 'dark';

const PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

type ThemePreferenceState = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

// Sin proveedor (no debería pasar) se comporta como "según el sistema".
const ThemePreferenceContext = createContext<ThemePreferenceState>({
  preference: 'system',
  setPreference: () => {},
});

// Tema elegido en Ajustes: claro, oscuro o el del sistema. Se recuerda en el
// dispositivo (no se borra al cerrar sesión).
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    void deviceStorage.get(StorageKeys.themePreference).then((stored) => {
      if (stored && PREFERENCES.includes(stored as ThemePreference)) {
        applyToNative(stored as ThemePreference);
        setPreferenceState(stored as ThemePreference);
      }
    });
  }, []);

  const setPreference = (next: ThemePreference) => {
    applyToNative(next);
    setPreferenceState(next);
    void deviceStorage.set(StorageKeys.themePreference, next);
  };

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceState {
  return useContext(ThemePreferenceContext);
}

// En iOS y Android, además de nuestros colores, cambia lo que dibuja el
// sistema (teclado, alertas, switches). En la web no existe: ahí basta con
// useColorScheme.
function applyToNative(preference: ThemePreference) {
  if (Platform.OS === 'web') return;
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}
