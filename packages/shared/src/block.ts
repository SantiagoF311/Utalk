import { z } from 'zod';
import { authorSchema } from './profile.ts';

// Alguien que bloqueaste (GET /blocks), para desbloquearlo desde Ajustes.
export const blockedUserSchema = z.object({
  user: authorSchema,
  blockedAt: z.iso.datetime(),
});

export type BlockedUser = z.infer<typeof blockedUserSchema>;
