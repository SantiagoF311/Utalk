import { z } from 'zod';
import { authorSchema } from './profile.ts';
import { voteValueSchema } from './vote.ts';

export const commentSchema = z.object({
  id: z.uuid(),
  postId: z.uuid(),
  parentId: z.uuid().nullable(),
  authorId: z.uuid(),
  body: z.string().min(1).max(2000),
  score: z.number().int(),
  deletedAt: z.iso.datetime().nullable(),
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

// Comentario tal como lo ve un usuario, con sus respuestas anidadas. Un
// comentario borrado conserva su lugar en el árbol (para no perder las
// respuestas) pero sin autor ni texto: la app lo muestra como "[eliminado]".
export const commentViewSchema = z.object({
  id: z.uuid(),
  postId: z.uuid(),
  parentId: z.uuid().nullable(),
  author: authorSchema.nullable(),
  body: z.string().nullable(),
  isDeleted: z.boolean(),
  score: z.number().int(),
  myVote: voteValueSchema.nullable(),
  createdAt: z.iso.datetime(),
  get replies() {
    return z.array(commentViewSchema);
  },
});

export type CommentView = z.infer<typeof commentViewSchema>;
