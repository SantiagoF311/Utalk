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
  // Si quien mira ya lo reportó (la app lo muestra oculto, con "Ver igual").
  reportedByMe: z.boolean(),
  createdAt: z.iso.datetime(),
  get replies() {
    return z.array(commentViewSchema);
  },
});

export type CommentView = z.infer<typeof commentViewSchema>;

// Un comentario en el perfil de su autor: con el título de su publicación
// ("en «…»"), sin respuestas. Los borrados no aparecen.
export const profileCommentSchema = z.object({
  id: z.uuid(),
  postId: z.uuid(),
  postTitle: z.string(),
  body: z.string(),
  score: z.number().int(),
  createdAt: z.iso.datetime(),
});

export type ProfileComment = z.infer<typeof profileCommentSchema>;

// GET /comments/by-author/:authorId?cursor=…&limit=…, del más nuevo al más viejo.
export const authorCommentsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type AuthorCommentsQuery = z.infer<typeof authorCommentsQuerySchema>;

export const profileCommentPageSchema = z.object({
  items: z.array(profileCommentSchema),
  nextCursor: z.string().nullable(),
});

export type ProfileCommentPage = z.infer<typeof profileCommentPageSchema>;
