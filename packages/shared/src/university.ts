import { z } from 'zod';

export const universitySchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  emailDomain: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export type University = z.infer<typeof universitySchema>;

// Lo que se muestra de la universidad junto a un usuario (autor de un post,
// perfil público): sin el dominio de correo ni fechas.
export const universitySummarySchema = universitySchema.pick({
  id: true,
  slug: true,
  name: true,
});

export type UniversitySummary = z.infer<typeof universitySummarySchema>;
