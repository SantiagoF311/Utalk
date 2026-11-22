import { z } from 'zod';

// new_post_in_community: alguien publicó en una comunidad a la que te uniste.
// report_resolved: un moderador resolvió algo que reportaste.
// content_removed: un moderador eliminó algo tuyo.
// content_held: la moderación por IA retuvo tu publicación hasta que la
// revise un moderador.
export const NOTIFICATION_TYPES = [
  'new_post_in_community',
  'report_resolved',
  'content_removed',
  'content_held',
] as const;

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

// Cuántas devuelve GET /notifications (las más nuevas).
export const NOTIFICATIONS_LIMIT = 50;

// Lo que tienen todas: el post (en un comentario, el post donde está) y su
// comunidad, para mostrar de qué se trata.
const notificationBaseSchema = z.object({
  id: z.uuid(),
  post: z.object({ id: z.uuid(), title: z.string() }),
  community: z.object({ id: z.uuid(), slug: z.string(), name: z.string() }),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

// Sobre qué era: la publicación o un comentario en ella.
const moderationTargetSchema = z.enum(['post', 'comment']);

export const notificationSchema = z.discriminatedUnion('type', [
  notificationBaseSchema.extend({ type: z.literal('new_post_in_community') }),
  // Para quien reportó: su número de caso y en qué quedó.
  notificationBaseSchema.extend({
    type: z.literal('report_resolved'),
    target: moderationTargetSchema,
    report: z.object({
      caseNumber: z.number().int().positive(),
      outcome: z.enum(['removed', 'dismissed']),
    }),
  }),
  // Para el autor. No dice quién lo reportó.
  notificationBaseSchema.extend({
    type: z.literal('content_removed'),
    target: moderationTargetSchema,
  }),
  // Para el autor: la IA solo retiene publicaciones (no comentarios).
  notificationBaseSchema.extend({ type: z.literal('content_held') }),
]);

export type NotificationView = z.infer<typeof notificationSchema>;

export const unreadNotificationCountSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type UnreadNotificationCount = z.infer<typeof unreadNotificationCountSchema>;

// Payloads de los jobs de la cola de BullMQ `notifications`.

// `notify-subscribers`: se publicó un post.
export const notifySubscribersJobSchema = z.object({ postId: z.uuid() });

export type NotifySubscribersJob = z.infer<typeof notifySubscribersJobSchema>;

// `notify-moderation-result`: un moderador resolvió este contenido
// (exactamente uno de los dos).
export const notifyModerationResultJobSchema = z
  .object({ postId: z.uuid().nullable(), commentId: z.uuid().nullable() })
  .refine((job) => (job.postId === null) !== (job.commentId === null), {
    message: 'Exactly one of postId or commentId must be set',
  });

export type NotifyModerationResultJob = z.infer<typeof notifyModerationResultJobSchema>;
