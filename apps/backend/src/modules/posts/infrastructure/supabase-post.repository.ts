import { BadRequestException, Injectable } from '@nestjs/common';
import type { Author, PostSort, VoteValue } from '@utalk/shared';
import { z } from 'zod';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { PostEntity } from '../domain/post.entity.js';
import type {
  NewPost,
  PostChanges,
  PostPage,
  PostPageQuery,
  PostRepository,
  PostWithAuthor,
} from '../domain/post.repository.js';

interface PostRow {
  id: string;
  forum_id: string;
  author_id: string;
  title: string;
  body: string;
  score: number;
  comment_count: number;
  hot: number;
  created_at: string;
}

interface PostWithAuthorRow extends PostRow {
  author: Author;
}

// Posición del último post de una página: el valor de la columna de orden
// más el id como desempate.
interface Cursor {
  value: string | number;
  id: string;
}

const WITH_AUTHOR = '*, author:profiles(id, username)';

function toEntity(row: PostRow): PostEntity {
  return new PostEntity(
    row.id,
    row.forum_id,
    row.author_id,
    row.title,
    row.body,
    row.score,
    row.comment_count,
    new Date(row.created_at),
  );
}

function toPostWithAuthor(row: PostWithAuthorRow): PostWithAuthor {
  return { post: toEntity(row), author: row.author };
}

const sortColumn: Record<PostSort, string> = {
  hot: 'hot',
  new: 'created_at',
  top: 'score',
};

const cursorValue: Record<PostSort, (row: PostRow) => string | number> = {
  hot: (row) => row.hot,
  new: (row) => row.created_at,
  top: (row) => row.score,
};

// El cursor guarda created_at tal cual viene de Postgres (con microsegundos);
// pasarlo por Date lo truncaría a milisegundos y la comparación fallaría.
function encodeCursor(row: PostRow, sort: PostSort): string {
  const cursor: Cursor = { value: cursorValue[sort](row), id: row.id };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

// El cursor viene del cliente y sus valores terminan dentro de un filtro
// `.or(...)` de PostgREST: se valida estricto para que no se pueda inyectar
// otra condición.
const cursorSchemas = {
  hot: z.object({ value: z.number(), id: z.uuid() }),
  new: z.object({ value: z.iso.datetime({ offset: true }), id: z.uuid() }),
  top: z.object({ value: z.number().int(), id: z.uuid() }),
} satisfies Record<PostSort, z.ZodType<Cursor>>;

function decodeCursor(raw: string, sort: PostSort): Cursor {
  try {
    return cursorSchemas[sort].parse(JSON.parse(Buffer.from(raw, 'base64url').toString()));
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}

@Injectable()
export class SupabasePostRepository implements PostRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async create(post: NewPost): Promise<PostEntity> {
    const { data, error } = await this.supabase.client
      .from('posts')
      .insert({
        forum_id: post.forumId,
        author_id: post.authorId,
        title: post.title,
        body: post.body,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async findById(id: string): Promise<PostEntity | null> {
    const { data, error } = await this.supabase.client
      .from('posts')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async findWithAuthorById(id: string): Promise<PostWithAuthor | null> {
    const { data, error } = await this.supabase.client
      .from('posts')
      .select(WITH_AUTHOR)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toPostWithAuthor(data as PostWithAuthorRow) : null;
  }

  async findPage(query: PostPageQuery): Promise<PostPage> {
    // El feed de un panel trae los posts de todos sus foros: inner join con
    // forums para poder filtrar por forums.panel_id.
    let request = this.supabase.client
      .from('posts')
      .select(query.panelId ? `${WITH_AUTHOR}, forums!inner(panel_id)` : WITH_AUTHOR);

    request = query.panelId
      ? request.eq('forums.panel_id', query.panelId)
      : request.eq('forum_id', query.forumId!);

    const column = sortColumn[query.sort];

    if (query.cursor) {
      const { value, id } = decodeCursor(query.cursor, query.sort);
      const quoted = typeof value === 'string' ? `"${value}"` : value;
      request = request.or(`${column}.lt.${quoted},and(${column}.eq.${quoted},id.lt.${id})`);
    }

    // Se pide uno de más solo para saber si hay página siguiente.
    const { data, error } = await request
      .order(column, { ascending: false })
      .order('id', { ascending: false })
      .limit(query.limit + 1);

    if (error) throw new Error(error.message);

    // El select se arma dinámico, así que supabase-js no puede inferir el tipo.
    const rows = data as unknown as PostWithAuthorRow[];
    const pageRows = rows.slice(0, query.limit);
    const hasMore = rows.length > query.limit;

    return {
      items: pageRows.map(toPostWithAuthor),
      nextCursor: hasMore ? encodeCursor(pageRows[pageRows.length - 1], query.sort) : null,
    };
  }

  async findVotesByUser(postIds: string[], userId: string): Promise<Map<string, VoteValue>> {
    if (postIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase.client
      .from('post_votes')
      .select('post_id, value')
      .eq('user_id', userId)
      .in('post_id', postIds);

    if (error) throw new Error(error.message);
    return new Map(
      (data as { post_id: string; value: VoteValue }[]).map((vote) => [vote.post_id, vote.value]),
    );
  }

  async update(id: string, changes: PostChanges): Promise<PostEntity> {
    // Los campos `undefined` se omiten al serializar, así que solo se
    // actualiza lo que vino en `changes`.
    const { data, error } = await this.supabase.client
      .from('posts')
      .update({ title: changes.title, body: changes.body })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('posts').delete().eq('id', id);

    if (error) throw new Error(error.message);
  }
}
