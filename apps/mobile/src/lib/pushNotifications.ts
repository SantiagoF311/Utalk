import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/lib/api';

// Push (ver docs/chat-realtime.md): el backend avisa de cada mensaje nuevo
// del chat y de cada notificación de la campana, por el servicio de push de
// Expo. En iOS funciona en Expo Go; en Android, Expo Go ya no recibe push
// (hace falta un build).

// Con la app abierta no se muestra la notificación del sistema: lo mismo
// llega por Realtime y se muestra el aviso interno de la app (ver
// lib/incomingAlerts.ts), como hacen WhatsApp o Instagram.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
  });
}

// El token de este celular, para borrarlo al cerrar sesión.
let registeredToken: string | null = null;

// Pide permiso (la primera vez) y registra el celular en el backend. Sin
// permiso, en un simulador o en la web no hace nada.
export async function registerForPush(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Mensajes y notificaciones',
      // Existe (TypeScript lo ve): el plugin de lint no sigue el `export *`
      // con el que expo-notifications lo reexporta.
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;

  // El id del proyecto en Expo (app.json → extra.eas.projectId).
  const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof projectId !== 'string') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.registerPushToken({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
  registeredToken = token;
}

// Al cerrar sesión: este celular deja de recibir avisos de esta cuenta.
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api.unregisterPushToken(token);
}
