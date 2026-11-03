import { z } from 'zod';
import { universitySummarySchema } from './university.ts';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;

export const PROFILE_ROLES = ['user', 'admin'] as const;

export const profileRoleSchema = z.enum(PROFILE_ROLES);

export type ProfileRole = z.infer<typeof profileRoleSchema>;

// El perfil completo: es lo que ve cada usuario de sí mismo (/auth/me).
export const profileSchema = z.object({
  id: z.uuid(),
  username: z.string().min(USERNAME_MIN_LENGTH).max(USERNAME_MAX_LENGTH),
  universityId: z.uuid(),
  role: profileRoleSchema,
  createdAt: z.iso.datetime(),
});

export type Profile = z.infer<typeof profileSchema>;

export const createProfileSchema = profileSchema.pick({
  username: true,
  universityId: true,
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;

// Regla de producto: junto a cada usuario siempre se muestra su universidad
// (en el panel de su universidad y en el general). Lo que no se muestra a
// otros es el rol ni nada de la cuenta (el correo nunca sale del backend).
export const authorSchema = profileSchema
  .pick({
    id: true,
    username: true,
  })
  .extend({
    university: universitySummarySchema,
  });

export type Author = z.infer<typeof authorSchema>;

// Perfil de otro usuario (GET /profiles/:id).
export const publicProfileSchema = authorSchema.extend({
  createdAt: z.iso.datetime(),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;
