import type { ErrorCode } from '@utalk/shared';

import { ApiError } from '@/lib/api';

// Texto para el usuario según el `code` del error de la API. Nunca se muestra
// el `detail` (técnico, en inglés). Los códigos que no están acá caen en el
// mensaje genérico.
const MESSAGES: Partial<Record<ErrorCode, string>> = {
  UNAUTHENTICATED: 'Tu sesión venció. Vuelve a iniciar sesión.',
  TOO_MANY_REQUESTS: 'Vas muy rápido. Espera un momento y vuelve a intentar.',
  PANEL_NOT_FOUND: 'Este panel ya no existe.',
  FORUM_NOT_FOUND: 'Este foro ya no existe.',
  POST_NOT_FOUND: 'Este post ya no existe.',
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? 'Algo salió mal. Intenta de nuevo.';
  }
  // fetch falla con TypeError cuando no hay conexión.
  return 'No pudimos conectarnos. Revisa tu conexión.';
}
