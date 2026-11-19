import type { ErrorCode } from '@utalk/shared';

import { ApiError } from '@/lib/api';

// Texto para el usuario según el `code` del error de la API. Nunca se muestra
// el `detail` (técnico, en inglés). Los códigos que no están acá caen en el
// mensaje genérico.
const MESSAGES: Partial<Record<ErrorCode, string>> = {
  UNAUTHENTICATED: 'Tu sesión venció. Vuelve a iniciar sesión.',
  TOO_MANY_REQUESTS: 'Vas muy rápido. Espera un momento y vuelve a intentar.',
  PANEL_NOT_FOUND: 'Este panel ya no existe.',
  COMMUNITY_NOT_FOUND: 'Esta comunidad ya no existe.',
  COMMUNITY_SLUG_TAKEN: 'Ya hay una comunidad con ese nombre corto en este panel. Prueba otro.',
  POST_NOT_FOUND: 'Esta publicación ya no existe.',
  POST_REMOVED: 'Un moderador eliminó esta publicación.',
  NOT_COMMUNITY_MODERATOR: 'No moderas esta comunidad.',
  NO_PENDING_REPORTS: 'Otro moderador ya resolvió este caso.',
  CONVERSATION_NOT_FOUND: 'Esta conversación ya no está disponible.',
  CANNOT_MESSAGE_SELF: 'No puedes escribirte a ti mismo.',
  CANNOT_MESSAGE_USER: 'No puedes escribirle a esta persona.',
  MESSAGE_REQUEST_PENDING: 'Espera a que acepte tu solicitud para mandarle otro mensaje.',
  CANNOT_BLOCK_SELF: 'No puedes bloquearte a ti mismo.',
  NOTIFICATION_NOT_FOUND: 'Esta notificación ya no existe.',
  CANNOT_PUBLISH_IN_PANEL: 'Solo puedes publicar en el panel de tu universidad o en el general.',
  NOT_POST_AUTHOR: 'Solo quien la publicó puede hacer eso.',
  COMMENT_NOT_FOUND: 'Este comentario ya no existe.',
  COMMENT_DELETED: 'Ese comentario fue eliminado.',
  NOT_COMMENT_AUTHOR: 'Solo quien lo escribió puede hacer eso.',
  VALIDATION_FAILED: 'Revisa lo que escribiste: algo no es válido.',
  PROFILE_PRIVATE: 'Este perfil es privado.',
  USERNAME_TAKEN: 'Ese apodo ya lo usa alguien (o lo dejó hace poco). Prueba otro.',
  USERNAME_CHANGE_TOO_SOON: 'Cambiaste tu apodo hace menos de 30 días. Vas a poder cambiarlo después.',
  ALREADY_REPORTED: 'Ya lo habías reportado. Un moderador lo va a revisar.',
  CANNOT_REPORT_OWN_CONTENT: 'No puedes reportar lo que escribiste tú. Si quieres, bórralo.',
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? 'Algo salió mal. Intenta de nuevo.';
  }
  // fetch falla con TypeError cuando no hay conexión.
  return 'No pudimos conectarnos. Revisa tu conexión.';
}
