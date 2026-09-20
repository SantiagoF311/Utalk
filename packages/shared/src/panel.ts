import { z } from 'zod';

export const panelSchema = z.object({
  id: z.uuid(),
  universityId: z.uuid().nullable(),
  slug: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export type Panel = z.infer<typeof panelSchema>;
