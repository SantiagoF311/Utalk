/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

export function useTheme() {
  const scheme = useColorScheme();
  // null = el sistema no informa un modo: se usa el claro.
  const theme = scheme === 'dark' ? 'dark' : 'light';

  return Colors[theme];
}
