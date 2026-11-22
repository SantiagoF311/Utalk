// Cola de la moderación por IA (ver docs/backend-y-colas.md). La encola
// PostsService (vía ContentReviewService) y la procesa el worker del módulo
// de moderación.
export const MODERATION_QUEUE_NAME = 'moderation';

export const MODERATE_CONTENT_JOB = 'moderate-content';

// Límite del proveedor de IA: como mucho 3 revisiones por minuto. Las que
// sobran esperan en la cola en vez de chocar contra el rate limit (429).
export const MODERATION_RATE_LIMIT = { max: 3, duration: 60_000 };
