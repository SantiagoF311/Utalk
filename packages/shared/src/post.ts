import { z } from 'zod';
import { authorSchema } from './profile.ts';
import { voteValueSchema } from './vote.ts';

export const postSchema = z.object({
  id: z.uuid(),
  communityId: z.uuid(),
  authorId: z.uuid(),
  title: z.string().min(1).max(300),
  body: z.string().min(1),
  score: z.number().int(),
  commentCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});

export type Post = z.infer<typeof postSchema>;

export const createPostSchema = postSchema.pick({
  communityId: true,
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

// Imagen opcional de un post: se manda en el mismo POST /posts (multipart,
// campo `image`). El backend mira los bytes, no el tipo que dice el cliente.
export const POST_IMAGE_FIELD = 'image';
export const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const POST_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type PostImageType = (typeof POST_IMAGE_TYPES)[number];

// Post tal como lo ve un usuario: con el apodo del autor resuelto, su
// propio voto (para pintar la flecha marcada), si ya lo reportó (la app lo
// muestra oculto, con "Ver igual") y la URL de su imagen.
export const postViewSchema = postSchema.omit({ authorId: true }).extend({
  author: authorSchema,
  myVote: voteValueSchema.nullable(),
  reportedByMe: z.boolean(),
  imageUrl: z.url().nullable(),
  // Retenido por la moderación por IA: solo su autor lo ve (con "En
  // revisión") hasta que un moderador decida.
  underReview: z.boolean(),
});

export type PostView = z.infer<typeof postViewSchema>;

// hot: votos ponderados por recencia (fórmula de Reddit), new: más recientes,
// top: más votados de siempre.
export const POST_SORTS = ['hot', 'new', 'top'] as const;

export const postSortSchema = z.enum(POST_SORTS);

export type PostSort = z.infer<typeof postSortSchema>;

// Feed de una comunidad, de un panel (posts de todas sus comunidades) o de un
// autor (su perfil), exactamente uno de los tres. Paginado por cursor:
// `nextCursor` de una página se manda como `cursor` para pedir la siguiente;
// es opaco para el cliente.
export const postFeedQuerySchema = z
  .object({
    communityId: z.uuid().optional(),
    panelId: z.uuid().optional(),
    authorId: z.uuid().optional(),
    sort: postSortSchema.default('hot'),
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine(
    (query) =>
      [query.communityId, query.panelId, query.authorId].filter((id) => id !== undefined)
        .length === 1,
    { message: 'Exactly one of communityId, panelId or authorId must be set' },
  );

export type PostFeedQuery = z.infer<typeof postFeedQuerySchema>;

export const postPageSchema = z.object({
  items: z.array(postViewSchema),
  nextCursor: z.string().nullable(),
});

export type PostPage = z.infer<typeof postPageSchema>;
