import { z } from 'zod';

export const panelSchema = z.object({
  id: z.uuid(),
  universityId: z.uuid().nullable(),
  slug: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export type Panel = z.infer<typeof panelSchema>;

export const createPanelSchema = panelSchema.pick({
  universityId: true,
  slug: true,
  name: true,
});

export type CreatePanelInput = z.infer<typeof createPanelSchema>;

export const updatePanelSchema = panelSchema.pick({
  name: true,
});

export type UpdatePanelInput = z.infer<typeof updatePanelSchema>;
