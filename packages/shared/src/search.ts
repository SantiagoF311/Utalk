import { z } from 'zod';
import { authorSchema } from './profile.ts';

export const SEARCH_SORTS = ['relevance', 'new'] as const;

export const searchSortSchema = z.enum(SEARCH_SORTS);

export type SearchSort = z.infer<typeof searchSortSchema>;

export const SEARCH_QUERY_MIN_LENGTH = 2;
export const SEARCH_QUERY_MAX_LENGTH = 100;

// GET /search?q=…&panelId=…&sort=relevance|new&cursor=…&limit=…
// Busca en publicaciones y comentarios de un panel; nunca en apodos.
// `cursor` es el `nextCursor` de la página anterior (opaco para el cliente).
export const searchQuerySchema = z.object({
  q: z.string().trim().min(SEARCH_QUERY_MIN_LENGTH).max(SEARCH_QUERY_MAX_LENGTH),
  panelId: z.uuid(),
  sort: searchSortSchema.default('relevance'),
  cursor: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// Un resultado: una publicación o un comentario (con el título de su
// publicación, para mostrar "en «…»"). Solo lo necesario para la lista; al
// tocarlo, la app abre el post completo.
export const searchResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('post'),
    id: z.uuid(),
    communityId: z.uuid(),
    title: z.string(),
    body: z.string(),
    score: z.number().int(),
    commentCount: z.number().int().nonnegative(),
    author: authorSchema,
    createdAt: z.iso.datetime(),
  }),
  z.object({
    kind: z.literal('comment'),
    id: z.uuid(),
    postId: z.uuid(),
    postTitle: z.string(),
    body: z.string(),
    score: z.number().int(),
    author: authorSchema,
    createdAt: z.iso.datetime(),
  }),
]);

export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchPageSchema = z.object({
  items: z.array(searchResultSchema),
  nextCursor: z.string().nullable(),
});

export type SearchPage = z.infer<typeof searchPageSchema>;
