/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Paleta del diseño de UTalk: azul institucional, fondos casi blancos y
// tarjetas con borde en vez de sombra.
export const Colors = {
  light: {
    text: '#0F172A',
    background: '#FFFFFF',
    backgroundElement: '#F1F3F7',
    backgroundSelected: '#E2E6EE',
    textSecondary: '#64748B',
    primary: '#0B3BBF',
    // Fondo suave del azul: chips de comunidad, ítem activo del sidebar.
    primarySoft: '#E8EEFB',
    onPrimary: '#FFFFFF',
    success: '#15803D',
    warning: '#B45309',
    border: '#E2E8F0',
  },
  // Oscuro como el de Reddit: grises neutros casi negros (sin tinte azul);
  // el azul queda solo para botones, enlaces y lo seleccionado.
  dark: {
    text: '#E3E6E8',
    background: '#0E1113',
    backgroundElement: '#1A1D21',
    backgroundSelected: '#2A3036',
    textSecondary: '#8B979E',
    primary: '#4A86F7',
    primarySoft: '#1B2333',
    onPrimary: '#FFFFFF',
    success: '#4ADE80',
    warning: '#FBBF24',
    border: '#2A3036',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
