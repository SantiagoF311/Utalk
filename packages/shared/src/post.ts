import { z } from 'zod';

export const postSchema = z.object({
  id: z.uuid(),
  forumId: z.uuid(),
  authorId: z.uuid(),
  title: z.string().min(1).max(300),
  body: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export type Post = z.infer<typeof postSchema>;

export const createPostSchema = postSchema.pick({
  forumId: true,
  title: true,
  body: true,
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = postSchema
  .pick({
    title: true,
    body: true,
  })
  .partial()
  .refine((post) => post.title !== undefined || post.body !== undefined, {
    message: 'At least one of title or body must be set',
  });

export type UpdatePostInput = z.infer<typeof updatePostSchema>;
