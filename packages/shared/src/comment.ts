import { z } from 'zod';

export const commentSchema = z.object({
  id: z.uuid(),
  postId: z.uuid(),
  parentId: z.uuid().nullable(),
  authorId: z.uuid(),
  body: z.string().min(1).max(2000),
  createdAt: z.iso.datetime(),
});

export type Comment = z.infer<typeof commentSchema>;

export const createCommentSchema = commentSchema.pick({
  postId: true,
  parentId: true,
  body: true,
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = commentSchema.pick({
  body: true,
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
