import { z } from 'zod';

export const communitySchema = z.object({
  id: z.uuid(),
  panelId: z.uuid(),
  slug: z.string().min(1).max(32),
  name: z.string().min(1).max(64),
  createdBy: z.uuid(),
  createdAt: z.iso.datetime(),
});

export type Community = z.infer<typeof communitySchema>;

export const createCommunitySchema = communitySchema.pick({
  panelId: true,
  slug: true,
  name: true,
});

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;

export const updateCommunitySchema = communitySchema.pick({
  name: true,
});

export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;
