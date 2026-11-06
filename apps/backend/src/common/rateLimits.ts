import type { ThrottlerOptions } from '@nestjs/throttler';

// Rate limiting anti-spam (ver docs/backend-y-colas.md). Se cuenta por IP y
// por ventana de 60 s. Superar el límite responde 429 TOO_MANY_REQUESTS.
//
// El contador vive en la memoria del proceso: alcanza mientras el backend
// corra en una sola instancia. Con más de una, cada una contaría por su
// lado, y habría que pasar el almacenamiento a Redis (Upstash).
const MINUTE = 60_000;

// Para cualquier endpoint: holgado para el uso normal de la app.
export const DEFAULT_RATE_LIMIT = {
  name: 'default',
  ttl: MINUTE,
  limit: 120,
} satisfies ThrottlerOptions;

// Límites más estrictos, para usar con @Throttle(...) en endpoints puntuales.
export const STRICT_RATE_LIMITS = {
  // Frena la fuerza bruta de contraseñas.
  login: { default: { ttl: MINUTE, limit: 10 } },
  // Crear contenido: spam de posts, comentarios y reportes.
  createPost: { default: { ttl: MINUTE, limit: 5 } },
  createComment: { default: { ttl: MINUTE, limit: 20 } },
  createReport: { default: { ttl: MINUTE, limit: 10 } },
};
