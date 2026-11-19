import { z } from 'zod';

// Códigos estables de error de la API. El cliente decide qué hacer (y qué
// texto mostrar) según `code`, nunca según `detail`, que es texto técnico en
// inglés para logs y depuración. Agregar un código = agregarlo acá y en el
// catálogo del backend (status + title).
export const ERROR_CODES = [
  // Genéricos: los usa el backend cuando no hay uno más específico.
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',

  // Auth y perfiles
  'INVALID_CREDENTIALS',
  'USERNAME_TAKEN',
  'PROFILE_ALREADY_EXISTS',
  'PROFILE_NOT_FOUND',
  'PROFILE_PRIVATE',
  'USERNAME_CHANGE_TOO_SOON',
  'ADMIN_ONLY',

  // Universidades
  'UNIVERSITY_NOT_FOUND',
  'EMAIL_DOMAIN_NOT_SUPPORTED',

  // Paneles
  'PANEL_NOT_FOUND',
  'PANEL_SLUG_TAKEN',
  'UNIVERSITY_ALREADY_HAS_PANEL',
  'CANNOT_PUBLISH_IN_PANEL',

  // Comunidades
  'COMMUNITY_NOT_FOUND',
  'COMMUNITY_SLUG_TAKEN',
  'NOT_COMMUNITY_MODERATOR',

  // Posts
  'POST_NOT_FOUND',
  'POST_REMOVED',
  'NOT_POST_AUTHOR',
  'INVALID_CURSOR',

  // Comentarios
  'COMMENT_NOT_FOUND',
  'NOT_COMMENT_AUTHOR',
  'COMMENT_DELETED',
  'PARENT_COMMENT_MISMATCH',

  // Reportes
  'REPORT_NOT_FOUND',
  'ALREADY_REPORTED',
  'CANNOT_REPORT_OWN_CONTENT',

  // Moderación
  'NO_PENDING_REPORTS',

  // Chat y bloqueos
  'CONVERSATION_NOT_FOUND',
  'CANNOT_MESSAGE_SELF',
  'CANNOT_MESSAGE_USER',
  'MESSAGE_REQUEST_PENDING',
  'CANNOT_BLOCK_SELF',

  // Notificaciones
  'NOTIFICATION_NOT_FOUND',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const fieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;

// Cuerpo de toda respuesta de error de la API: "Problem Details" de
// RFC 9457 (Content-Type: application/problem+json) con dos extensiones,
// `code` y `errors`. Ver docs/observabilidad.md.
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
  code: errorCodeSchema,
  // Detalle por campo; vacío salvo en VALIDATION_FAILED.
  errors: z.array(fieldErrorSchema),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
