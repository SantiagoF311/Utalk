import { HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@utalk/shared';

interface ErrorDefinition {
  status: HttpStatus;
  // `title` de RFC 9457: resumen fijo del tipo de error (el mismo para todas
  // sus ocurrencias). El detalle de cada caso va en `detail`.
  title: string;
}

// Un solo lugar donde cada código tiene su status HTTP, así quien lanza el
// error no puede equivocarse de status. `satisfies` obliga a que estén todos.
export const ERROR_CATALOG = {
  BAD_REQUEST: { status: HttpStatus.BAD_REQUEST, title: 'Bad request' },
  VALIDATION_FAILED: { status: HttpStatus.BAD_REQUEST, title: 'Validation failed' },
  UNAUTHENTICATED: { status: HttpStatus.UNAUTHORIZED, title: 'Authentication required' },
  FORBIDDEN: { status: HttpStatus.FORBIDDEN, title: 'Forbidden' },
  NOT_FOUND: { status: HttpStatus.NOT_FOUND, title: 'Not found' },
  CONFLICT: { status: HttpStatus.CONFLICT, title: 'Conflict' },
  TOO_MANY_REQUESTS: { status: HttpStatus.TOO_MANY_REQUESTS, title: 'Too many requests' },
  INTERNAL_ERROR: { status: HttpStatus.INTERNAL_SERVER_ERROR, title: 'Internal server error' },

  INVALID_CREDENTIALS: { status: HttpStatus.UNAUTHORIZED, title: 'Invalid credentials' },
  USERNAME_TAKEN: { status: HttpStatus.CONFLICT, title: 'Username already taken' },
  PROFILE_ALREADY_EXISTS: { status: HttpStatus.CONFLICT, title: 'Profile already exists' },
  PROFILE_NOT_FOUND: { status: HttpStatus.NOT_FOUND, title: 'Profile not found' },
  PROFILE_PRIVATE: { status: HttpStatus.FORBIDDEN, title: 'This profile is private' },
  USERNAME_CHANGE_TOO_SOON: {
    status: HttpStatus.CONFLICT,
    title: 'Username was changed too recently',
  },
  ADMIN_ONLY: { status: HttpStatus.FORBIDDEN, title: 'Admin only' },

  UNIVERSITY_NOT_FOUND: { status: HttpStatus.NOT_FOUND, title: 'University not found' },
  EMAIL_DOMAIN_NOT_SUPPORTED: { status: HttpStatus.NOT_FOUND, title: 'Email domain not supported' },

  PANEL_NOT_FOUND: { status: HttpStatus.NOT_FOUND, title: 'Panel not found' },
  PANEL_SLUG_TAKEN: { status: HttpStatus.CONFLICT, title: 'Panel slug already taken' },
  UNIVERSITY_ALREADY_HAS_PANEL: {
    status: HttpStatus.CONFLICT,
    title: 'University already has a panel',
  },
  CANNOT_PUBLISH_IN_PANEL: { status: HttpStatus.FORBIDDEN, title: 'Cannot publish in this panel' },

  COMMUNITY_NOT_FOUND: { status: HttpStatus.NOT_FOUND, title: 'Community not found' },
  COMMUNITY_SLUG_TAKEN: { status: HttpStatus.CONFLICT, title: 'Community slug already taken' },
  NOT_COMMUNITY_MODERATOR: {
    status: HttpStatus.FORBIDDEN,
    title: 'Not a moderator of this community',
  },

  POST_NOT_FOUND: { status: HttpStatus.NOT_FOUND, title: 'Post not found' },
  POST_REMOVED: { status: HttpStatus.GONE, title: 'Post was removed by moderation' },
  NOT_POST_AUTHOR: { status: HttpStatus.FORBIDDEN, title: 'Not the author of this post' },
  INVALID_CURSOR: { status: HttpStatus.BAD_REQUEST, title: 'Invalid cursor' },

  COMMENT_NOT_FOUND: { status: HttpStatus.NOT_FOUND, title: 'Comment not found' },
  NOT_COMMENT_AUTHOR: { status: HttpStatus.FORBIDDEN, title: 'Not the author of this comment' },
  COMMENT_DELETED: { status: HttpStatus.BAD_REQUEST, title: 'Comment was deleted' },
  PARENT_COMMENT_MISMATCH: {
    status: HttpStatus.BAD_REQUEST,
    title: 'Parent comment belongs to another post',
  },

  REPORT_NOT_FOUND: { status: HttpStatus.NOT_FOUND, title: 'Report not found' },
  ALREADY_REPORTED: { status: HttpStatus.CONFLICT, title: 'Already reported' },
  CANNOT_REPORT_OWN_CONTENT: {
    status: HttpStatus.FORBIDDEN,
    title: 'Cannot report your own content',
  },

  NO_PENDING_REPORTS: { status: HttpStatus.CONFLICT, title: 'No pending reports' },

  CONVERSATION_NOT_FOUND: { status: HttpStatus.NOT_FOUND, title: 'Conversation not found' },
  CANNOT_MESSAGE_SELF: { status: HttpStatus.BAD_REQUEST, title: 'Cannot message yourself' },
  // Hay un bloqueo entre los dos (en cualquier sentido). No dice quién
  // bloqueó a quién.
  CANNOT_MESSAGE_USER: { status: HttpStatus.FORBIDDEN, title: 'Cannot message this user' },
  MESSAGE_REQUEST_PENDING: {
    status: HttpStatus.CONFLICT,
    title: 'Message request not accepted yet',
  },
  CANNOT_BLOCK_SELF: { status: HttpStatus.BAD_REQUEST, title: 'Cannot block yourself' },
} satisfies Record<ErrorCode, ErrorDefinition>;

// Para las excepciones de Nest que no son AppException (ParseUUIDPipe,
// rutas inexistentes, body con JSON inválido…): código genérico según status.
export function genericCodeForStatus(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'TOO_MANY_REQUESTS';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  }
}
