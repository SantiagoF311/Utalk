import type { Job } from 'bullmq';

// Un intento fallido que BullMQ todavía va a reintentar no es un problema;
// el último, sí: ese trabajo no se va a hacer. Es el que se reporta a Sentry.
export function isFinalAttempt(job: Pick<Job, 'attemptsMade' | 'opts'>): boolean {
  return job.attemptsMade >= (job.opts.attempts ?? 1);
}

// Opciones de los jobs de las colas del backend (ver docs/backend-y-colas.md):
// 3 intentos con espera creciente. En `notifications` reintentar no duplica
// nada (unique en la tabla); en `push`, en el peor caso (Expo entregó pero
// el job falló después) llega un aviso repetido, que es preferible a ninguno.
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  // Redis no es fuente de verdad: los jobs terminados no se guardan.
  removeOnComplete: true,
  removeOnFail: 100,
};
