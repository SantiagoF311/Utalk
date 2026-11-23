import { AppState } from 'react-native';

import type { IconName } from '@/components/icon';

// Aviso interno (ver components/inAppAlert.tsx): lo que se muestra arriba
// cuando llega algo con la app abierta, en vez de la notificación del
// sistema (que queda para la app cerrada o en segundo plano). Lo disparan
// las suscripciones de Realtime del chat y de las notificaciones.
export interface InAppAlert {
  // Uno nuevo reemplaza al que se está mostrando.
  id: string;
  icon: IconName;
  title: string;
  body: string;
  onPress: () => void;
}

type Listener = () => void;

let current: InAppAlert | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function showInAppAlert(alert: InAppAlert): void {
  current = alert;
  emit();
}

export function dismissInAppAlert(id: string): void {
  if (current?.id !== id) return;
  current = null;
  emit();
}

export function subscribeInAppAlert(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getInAppAlert(): InAppAlert | null {
  return current;
}

// ¿La app está a la vista? En el celular, abierta y en primer plano; en la
// web, la pestaña visible. Si no, el aviso es el del sistema (push o del
// navegador), no el interno.
export function isAppInForeground(): boolean {
  return AppState.currentState === 'active';
}
