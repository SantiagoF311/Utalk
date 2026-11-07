import Constants from 'expo-constants';
import { Platform } from 'react-native';

const LOCALHOST = /^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/;

// Solo en desarrollo y en un celular: si EXPO_PUBLIC_API_URL apunta a
// localhost, se reemplaza por la IP del computador que sirve la app (la que
// usa Metro, que Expo expone en `hostUri`, ej. "192.168.1.52:8081"). En el
// celular "localhost" es el propio celular, así que sin esto habría que poner
// la IP a mano en el .env y actualizarla cada vez que el router la cambia.
// En la web y en producción la URL se usa tal cual.
export function resolveApiUrl(configured: string): string {
  if (!__DEV__ || Platform.OS === 'web' || !LOCALHOST.test(configured)) {
    return configured;
  }

  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return devHost ? configured.replace(LOCALHOST, `$1${devHost}`) : configured;
}
