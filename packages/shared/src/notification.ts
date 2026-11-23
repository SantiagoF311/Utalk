import { z } from 'zod';

// new_post_in_community: alguien publicó en una comunidad a la que te uniste.
// report_resolved: un moderador resolvió algo que reportaste.
// content_removed: un moderador eliminó algo tuyo.
// content_held: la moderación por IA retuvo tu publicación hasta que la
// revise un moderador.
// content_kept: un moderador revisó algo tuyo que estaba reportado (o
// retenido por la IA) y lo dejó.
export const NOTIFICATION_TYPES = [
  'new_post_in_community',
  'report_resolved',
  'content_removed',
  'content_held',
  'content_kept',
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
  // Para el autor. Tampoco dice quién lo reportó.
  notificationBaseSchema.extend({
    type: z.literal('content_kept'),
    target: moderationTargetSchema,
  }),
]);

export type NotificationView = z.infer<typeof notificationSchema>;

// Adónde lleva tocar un aviso (en la lista o en el push): la publicación,
// "Mis reportes" (el caso completo), o ningún lado (una publicación tuya
// eliminada ya no se puede abrir).
export const NOTIFICATION_LINKS = ['post', 'my-reports', 'none'] as const;

export const notificationLinkSchema = z.enum(NOTIFICATION_LINKS);

export type NotificationLink = z.infer<typeof notificationLinkSchema>;

export interface NotificationMessage {
  // Lo de arriba en la lista; el título en el push.
  kicker: string;
  text: string;
  link: NotificationLink;
}

// Qué dice cada aviso. Lo usan la lista del mobile y el push del backend,
// así los dos dicen lo mismo.
export function describeNotification(notification: NotificationView): NotificationMessage {
  const title = `«${notification.post.title}»`;

  switch (notification.type) {
    case 'new_post_in_community':
      return {
        kicker: `Nueva publicación en c/${notification.community.slug}`,
        text: notification.post.title,
        link: 'post',
      };
    case 'report_resolved': {
      const { caseNumber, outcome } = notification.report;
      const onComment = notification.target === 'comment';
      const text =
        outcome === 'removed'
          ? onComment
            ? `Eliminamos el comentario que reportaste en ${title}.`
            : `Eliminamos la publicación ${title}.`
          : onComment
            ? `Revisamos el comentario que reportaste en ${title} y lo dejamos: no incumple las normas.`
            : `Revisamos ${title} y la dejamos: no incumple las normas.`;
      return { kicker: `Tu reporte · caso #${caseNumber}`, text, link: 'my-reports' };
    }
    case 'content_held':
      // Su autor la sigue viendo (con "En revisión"): se puede abrir.
      return {
        kicker: 'Moderación',
        text: `Tu publicación ${title} está en revisión: la moderación automática la marcó y un moderador la va a revisar. Mientras tanto, solo tú la ves.`,
        link: 'post',
      };
    case 'content_kept':
      return {
        kicker: 'Moderación',
        text:
          notification.target === 'comment'
            ? `Un moderador revisó tu comentario en ${title} y lo dejó: no incumple las normas.`
            : `Un moderador revisó tu publicación ${title} y la dejó publicada: no incumple las normas.`,
        link: 'post',
      };
    case 'content_removed':
      return notification.target === 'comment'
        ? {
            kicker: 'Moderación',
            text: `Un moderador eliminó tu comentario en ${title} por no cumplir las normas.`,
            link: 'post',
          }
        : {
            kicker: 'Moderación',
            text: `Un moderador eliminó tu publicación ${title} por no cumplir las normas.`,
            link: 'none',
          };
  }
}

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
