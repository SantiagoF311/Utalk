import { z } from 'zod';

// new_post_in_community: alguien publicó en una comunidad a la que te uniste.
export const NOTIFICATION_TYPES = ['new_post_in_community'] as const;

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

// Cuántas devuelve GET /notifications (las más nuevas).
export const NOTIFICATIONS_LIMIT = 50;

export const notificationSchema = z.object({
  id: z.uuid(),
  type: notificationTypeSchema,
  post: z.object({ id: z.uuid(), title: z.string() }),
  community: z.object({ id: z.uuid(), slug: z.string(), name: z.string() }),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type NotificationView = z.infer<typeof notificationSchema>;

export const unreadNotificationCountSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type UnreadNotificationCount = z.infer<typeof unreadNotificationCountSchema>;

// Payload del job `notify-subscribers` de la cola de BullMQ `notifications`.
export const notifySubscribersJobSchema = z.object({ postId: z.uuid() });

export type NotifySubscribersJob = z.infer<typeof notifySubscribersJobSchema>;
