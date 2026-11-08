import { z } from 'zod';
import { universitySummarySchema } from './university.ts';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;

// El apodo se puede cambiar una vez cada tantos días, y el viejo queda
// reservado ese mismo tiempo (nadie más lo puede tomar). Ver
// docs/modelo-de-datos.md.
export const USERNAME_CHANGE_COOLDOWN_DAYS = 30;

export const PROFILE_ROLES = ['user', 'admin'] as const;

export const profileRoleSchema = z.enum(PROFILE_ROLES);

export type ProfileRole = z.infer<typeof profileRoleSchema>;

export const usernameSchema = z.string().min(USERNAME_MIN_LENGTH).max(USERNAME_MAX_LENGTH);

// El perfil completo: es lo que ve cada usuario de sí mismo (/auth/me).
export const profileSchema = z.object({
  id: z.uuid(),
  username: usernameSchema,
  universityId: z.uuid(),
  role: profileRoleSchema,
  // Si es privado, los demás no ven su historial ni sus contadores.
  isPrivate: z.boolean(),
  // Último cambio de apodo (null = nunca): de acá sale cuándo puede volver a
  // cambiarlo.
  usernameChangedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type Profile = z.infer<typeof profileSchema>;

export const createProfileSchema = profileSchema.pick({
  username: true,
  universityId: true,
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;

// PATCH /profiles/me: cambiar el apodo y/o la privacidad.
export const updateMyProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    isPrivate: z.boolean().optional(),
  })
  .refine((input) => input.username !== undefined || input.isPrivate !== undefined, {
    message: 'At least one of username or isPrivate must be set',
  });

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

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

export const profileStatsSchema = z.object({
  // Votos recibidos: suma de los puntajes de sus publicaciones y comentarios.
  karma: z.number().int(),
  postCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
});

export type ProfileStats = z.infer<typeof profileStatsSchema>;

// Perfil de un usuario (GET /profiles/:id), el propio o el de otro. Si es
// privado y no es el tuyo, `stats` viene en null (y su historial no se puede
// pedir).
export const publicProfileSchema = authorSchema.extend({
  isPrivate: z.boolean(),
  stats: profileStatsSchema.nullable(),
  createdAt: z.iso.datetime(),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;
