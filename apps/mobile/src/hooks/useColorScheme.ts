import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemePreference } from '@/hooks/useThemePreference';

// El tema elegido en Ajustes, o el del sistema si se eligió "según el sistema".
export function useColorScheme() {
  const system = useSystemColorScheme();
  const { preference } = useThemePreference();
  return preference === 'system' ? system : preference;
}
