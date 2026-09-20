import { z } from 'zod';

export const universitySchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  emailDomain: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export type University = z.infer<typeof universitySchema>;
