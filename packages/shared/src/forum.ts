import { z } from 'zod';

export const forumSchema = z.object({
  id: z.uuid(),
  panelId: z.uuid(),
  slug: z.string().min(1).max(32),
  name: z.string().min(1).max(64),
  createdBy: z.uuid(),
  createdAt: z.iso.datetime(),
});

export type Forum = z.infer<typeof forumSchema>;

export const createForumSchema = forumSchema.pick({
  panelId: true,
  slug: true,
  name: true,
});

export type CreateForumInput = z.infer<typeof createForumSchema>;
