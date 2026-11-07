import AsyncStorage from '@react-native-async-storage/async-storage';

// Preferencias que se guardan solo en este dispositivo (no en el backend).
export const StorageKeys = {
  // De la cuenta: se borran al cerrar sesión.
  selectedPanelId: 'utalk.selectedPanelId',
  recentCommunities: 'utalk.recentCommunities',
  // Del dispositivo: sobreviven al cerrar sesión.
  themePreference: 'utalk.themePreference',
} as const;

const ACCOUNT_KEYS = [StorageKeys.selectedPanelId, StorageKeys.recentCommunities];

// Si el almacenamiento falla (modo privado del navegador, disco lleno), la
// app sigue funcionando sin recordar nada: no son datos importantes.
export const deviceStorage = {
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Ver arriba.
    }
  },

  // Al cerrar sesión: otra cuenta en el mismo dispositivo no debe ver qué
  // comunidades visitó la anterior. El tema elegido se queda: es del
  // dispositivo, no de la cuenta.
  async clearAccountData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(ACCOUNT_KEYS);
    } catch {
      // Ver arriba.
    }
  },
};
