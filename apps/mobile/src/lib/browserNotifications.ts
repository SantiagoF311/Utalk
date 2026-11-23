import { Platform } from 'react-native';

// En la web no hay push con la pestaña cerrada (ver docs/chat-realtime.md),
// pero sí un aviso del navegador mientras la pestaña está abierta pero
// oculta. Con la pestaña a la vista se usa el aviso interno (ver
// lib/incomingAlerts.ts, que decide cuál).

function isSupported(): boolean {
  return Platform.OS === 'web' && typeof Notification !== 'undefined';
}

export function requestBrowserNotificationPermission(): void {
  if (isSupported() && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

export function showBrowserNotification(alert: {
  title: string;
  body: string;
  // Varios con el mismo tag se reemplazan en vez de apilarse.
  tag: string;
  onClick: () => void;
}): void {
  if (!isSupported() || Notification.permission !== 'granted') return;

  const notification = new Notification(alert.title, { body: alert.body, tag: alert.tag });
  notification.onclick = () => {
    window.focus();
    alert.onClick();
    notification.close();
  };
}
