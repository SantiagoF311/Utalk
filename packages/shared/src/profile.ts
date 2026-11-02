import { z } from 'zod';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;

export const profileSchema = z.object({
  id: z.uuid(),
  username: z.string().min(USERNAME_MIN_LENGTH).max(USERNAME_MAX_LENGTH),
  universityId: z.uuid(),
  createdAt: z.iso.datetime(),
});

export type Profile = z.infer<typeof profileSchema>;

export const createProfileSchema = profileSchema.pick({
  username: true,
  universityId: true,
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;

// Lo que se muestra del autor de un post o comentario: solo el apodo, nunca
// la universidad ni nada que ayude a identificarlo.
export const authorSchema = profileSchema.pick({
  id: true,
  username: true,
});

export type Author = z.infer<typeof authorSchema>;
