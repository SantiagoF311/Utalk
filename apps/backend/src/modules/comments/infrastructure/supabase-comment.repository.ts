import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { CommentEntity } from '../domain/comment.entity.js';
import type { CommentChanges, CommentRepository, NewComment } from '../domain/comment.repository.js';

interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
}

function toEntity(row: CommentRow): CommentEntity {
  return new CommentEntity(
    row.id,
    row.post_id,
    row.parent_id,
    row.author_id,
    row.body,
    new Date(row.created_at),
  );
}

@Injectable()
export class SupabaseCommentRepository implements CommentRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async create(comment: NewComment): Promise<CommentEntity> {
    const { data, error } = await this.supabase.client
      .from('comments')
      .insert({
        post_id: comment.postId,
        parent_id: comment.parentId,
        author_id: comment.authorId,
        body: comment.body,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEntity(data);
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

  async findByPostId(postId: string): Promise<CommentEntity[]> {
    const { data, error } = await this.supabase.client
      .from('comments')
      .select()
      .eq('post_id', postId)
      .order('created_at');

    if (error) throw new Error(error.message);
    return (data as CommentRow[]).map(toEntity);
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

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('comments').delete().eq('id', id);

    if (error) throw new Error(error.message);
  }
}
