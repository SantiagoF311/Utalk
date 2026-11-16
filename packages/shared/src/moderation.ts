import { z } from 'zod';
import { reportCategorySchema } from './report.ts';

// Qué puede moderar quien pregunta (GET /moderation/scope): todo si es admin,
// o las comunidades donde es moderador. Si no es ninguna de las dos, la app
// no muestra la entrada a moderación.
export const moderationScopeSchema = z.object({
  isAdmin: z.boolean(),
  communities: z.array(z.object({ id: z.uuid(), slug: z.string(), name: z.string() })),
});

export type ModerationScope = z.infer<typeof moderationScopeSchema>;

// GET /moderation/queue?communityId=… (sin communityId: todas las que modera).
export const moderationQueueQuerySchema = z.object({
  communityId: z.uuid().optional(),
});

export type ModerationQueueQuery = z.infer<typeof moderationQueueQuerySchema>;

// Una entrada de la cola: un post o comentario con todos sus reportes
// pendientes juntos. Se modera el contenido, no cada reporte por separado.
// Primero lo más grave (amenazas y lo que expone a alguien) y, a igual
// gravedad, lo que lleva más tiempo esperando.
export const moderationCaseSchema = z.object({
  // La publicación reportada o, si lo reportado es un comentario, la
  // publicación donde está (para abrirla).
  postId: z.uuid(),
  postTitle: z.string(),
  // Solo si lo reportado es un comentario.
  commentId: z.uuid().nullable(),
  community: z.object({ id: z.uuid(), slug: z.string() }),
  // Texto del contenido reportado, aunque su autor lo haya borrado: la
  // moderación necesita verlo para decidir.
  body: z.string(),
  author: z.object({ id: z.uuid(), username: z.string() }),
  // Su autor lo borró después de que lo reportaran.
  isDeleted: z.boolean(),
  reportCount: z.number().int().positive(),
  categories: z.array(reportCategorySchema),
  // Los detalles que escribieron quienes reportaron (sin quiénes fueron).
  reasons: z.array(z.string()),
  firstReportedAt: z.iso.datetime(),
  lastReportedAt: z.iso.datetime(),
});

export type ModerationCase = z.infer<typeof moderationCaseSchema>;

// remove: elimina el contenido (queda "eliminado por moderación");
// dismiss: lo deja como está. En los dos casos se cierran todos sus reportes
// pendientes.
export const MODERATION_ACTIONS = ['remove', 'dismiss'] as const;

export const moderationActionSchema = z.enum(MODERATION_ACTIONS);

export type ModerationAction = z.infer<typeof moderationActionSchema>;

// POST /moderation/resolve. Exactamente uno de postId / commentId.
export const resolveReportsSchema = z
  .object({
    postId: z.uuid().nullable(),
    commentId: z.uuid().nullable(),
    action: moderationActionSchema,
  })
  .refine((input) => (input.postId === null) !== (input.commentId === null), {
    message: 'Exactly one of postId or commentId must be set',
  });

export type ResolveReportsInput = z.infer<typeof resolveReportsSchema>;

export const resolveReportsResultSchema = z.object({
  // Cuántos reportes se cerraron.
  resolvedCount: z.number().int().positive(),
});

export type ResolveReportsResult = z.infer<typeof resolveReportsResultSchema>;
