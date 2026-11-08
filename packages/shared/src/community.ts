import { z } from 'zod';

// Temas de las comunidades: lista fija para poder explorar por tema (chips en
// la pestaña Comunidades). Pensados para la vida universitaria.
export const COMMUNITY_TOPICS = [
  'academic', // materias, profes, parciales
  'campus_life', // la vida en la U
  'marketplace', // compraventa
  'events',
  'sports',
  'venting', // desahogo
  'lost_and_found', // perdidos y encontrados
  'other',
] as const;

export const communityTopicSchema = z.enum(COMMUNITY_TOPICS);

export type CommunityTopic = z.infer<typeof communityTopicSchema>;

export const COMMUNITY_DESCRIPTION_MAX_LENGTH = 300;

export const communitySchema = z.object({
  id: z.uuid(),
  panelId: z.uuid(),
  // Lo que va en c/<slug>: minúsculas, números y guion bajo.
  slug: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(64),
  description: z.string().max(COMMUNITY_DESCRIPTION_MAX_LENGTH),
  topic: communityTopicSchema,
  // Lo mantiene un trigger (ver la migración de miembros).
  memberCount: z.number().int().nonnegative(),
  createdBy: z.uuid(),
  createdAt: z.iso.datetime(),
});

export type Community = z.infer<typeof communitySchema>;

// Comunidad tal como la ve un usuario: si ya se unió.
export const communityViewSchema = communitySchema.extend({
  joinedByMe: z.boolean(),
});

export type CommunityView = z.infer<typeof communityViewSchema>;

export const createCommunitySchema = communitySchema
  .pick({
    panelId: true,
    slug: true,
    name: true,
    topic: true,
  })
  .extend({
    description: communitySchema.shape.description.trim().default(''),
  });

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;

export const updateCommunitySchema = communitySchema
  .pick({
    name: true,
    description: true,
    topic: true,
  })
  .partial()
  .refine(
    (community) =>
      community.name !== undefined ||
      community.description !== undefined ||
      community.topic !== undefined,
    { message: 'At least one of name, description or topic must be set' },
  );

export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;
