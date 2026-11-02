import { z } from 'zod';
import { authorSchema } from './profile.ts';
import { voteValueSchema } from './vote.ts';

export const postSchema = z.object({
  id: z.uuid(),
  forumId: z.uuid(),
  authorId: z.uuid(),
  title: z.string().min(1).max(300),
  body: z.string().min(1),
  score: z.number().int(),
  commentCount: z.number().int().nonnegative(),
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

// Post tal como lo ve un usuario: con el apodo del autor resuelto y su
// propio voto (para pintar la flecha marcada).
export const postViewSchema = postSchema.omit({ authorId: true }).extend({
  author: authorSchema,
  myVote: voteValueSchema.nullable(),
});

export type PostView = z.infer<typeof postViewSchema>;

// hot: votos ponderados por recencia (fórmula de Reddit), new: más recientes,
// top: más votados de siempre.
export const POST_SORTS = ['hot', 'new', 'top'] as const;

export const postSortSchema = z.enum(POST_SORTS);

export type PostSort = z.infer<typeof postSortSchema>;

// Feed de un foro o de un panel (posts de todos sus foros), paginado por
// cursor: `nextCursor` de una página se manda como `cursor` para pedir la
// siguiente; es opaco para el cliente.
export const postFeedQuerySchema = z
  .object({
    forumId: z.uuid().optional(),
    panelId: z.uuid().optional(),
    sort: postSortSchema.default('hot'),
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((query) => (query.forumId === undefined) !== (query.panelId === undefined), {
    message: 'Exactly one of forumId or panelId must be set',
  });

export type PostFeedQuery = z.infer<typeof postFeedQuerySchema>;

export const postPageSchema = z.object({
  items: z.array(postViewSchema),
  nextCursor: z.string().nullable(),
});

export type PostPage = z.infer<typeof postPageSchema>;
