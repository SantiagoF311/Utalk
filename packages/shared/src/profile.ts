import { z } from 'zod';

export const profileSchema = z.object({
  id: z.uuid(),
  username: z.string().min(3).max(24),
  universityId: z.uuid(),
  createdAt: z.iso.datetime(),
});

export type Profile = z.infer<typeof profileSchema>;

export const createProfileSchema = profileSchema.pick({
  username: true,
  universityId: true,
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
