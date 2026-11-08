import { Injectable } from '@nestjs/common';
import type { Author, VoteValue } from '@utalk/shared';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { CommentEntity } from '../domain/comment.entity.js';
import type {
  CommentChanges,
  CommentRepository,
  CommentWithAuthor,
  NewComment,
} from '../domain/comment.repository.js';

interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  score: number;
  deleted_at: string | null;
  created_at: string;
}

interface CommentWithAuthorRow extends CommentRow {
  author: Author;
}

// Se nombra la FK porque comments y profiles también se relacionan vía
// comment_votes y reports, y PostgREST no sabría cuál usar.
const WITH_AUTHOR =
  '*, author:profiles!comments_author_id_fkey(id, username, university:universities(id, slug, name))';

function toEntity(row: CommentRow): CommentEntity {
  return new CommentEntity(
    row.id,
    row.post_id,
    row.parent_id,
    row.author_id,
    row.body,
    row.score,
    row.deleted_at ? new Date(row.deleted_at) : null,
    new Date(row.created_at),
  );
}

function toCommentWithAuthor(row: CommentWithAuthorRow): CommentWithAuthor {
  return { comment: toEntity(row), author: row.author };
}

@Injectable()
export class SupabaseCommentRepository implements CommentRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async create(comment: NewComment): Promise<CommentWithAuthor> {
    // El insert devuelve la fila con el join del autor: evita releerla.
    const { data, error } = await this.supabase.client
      .from('comments')
      .insert({
        post_id: comment.postId,
        parent_id: comment.parentId,
        author_id: comment.authorId,
        body: comment.body,
      })
      .select(WITH_AUTHOR)
      .single();

    if (error) throw new Error(error.message);
    return toCommentWithAuthor(data as CommentWithAuthorRow);
  }

  async findById(id: string): Promise<CommentEntity | null> {
    const { data, error } = await this.supabase.client
      .from('comments')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async findWithAuthorById(id: string): Promise<CommentWithAuthor | null> {
    const { data, error } = await this.supabase.client
      .from('comments')
      .select(WITH_AUTHOR)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toCommentWithAuthor(data as CommentWithAuthorRow) : null;
  }

  async findWithAuthorByPostId(postId: string): Promise<CommentWithAuthor[]> {
    const { data, error } = await this.supabase.client
      .from('comments')
      .select(WITH_AUTHOR)
      .eq('post_id', postId)
      .order('created_at');

    if (error) throw new Error(error.message);
    return (data as CommentWithAuthorRow[]).map(toCommentWithAuthor);
  }

  async findVotesByUser(commentIds: string[], userId: string): Promise<Map<string, VoteValue>> {
    if (commentIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase.client
      .from('comment_votes')
      .select('comment_id, value')
      .eq('user_id', userId)
      .in('comment_id', commentIds);

    if (error) throw new Error(error.message);
    return new Map(
      (data as { comment_id: string; value: VoteValue }[]).map((vote) => [
        vote.comment_id,
        vote.value,
      ]),
    );
  }

  async findReportedByUser(commentIds: string[], userId: string): Promise<Set<string>> {
    if (commentIds.length === 0) {
      return new Set();
    }

    const { data, error } = await this.supabase.client
      .from('reports')
      .select('comment_id')
      .eq('reported_by', userId)
      .in('comment_id', commentIds);

    if (error) throw new Error(error.message);
    return new Set((data as { comment_id: string }[]).map((report) => report.comment_id));
  }

  async update(id: string, changes: CommentChanges): Promise<CommentEntity> {
    const { data, error } = await this.supabase.client
      .from('comments')
      .update({ body: changes.body })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  // El texto se conserva en la base (sirve para revisar reportes); la API
  // nunca lo devuelve una vez borrado.
  async softDelete(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
  }
}
