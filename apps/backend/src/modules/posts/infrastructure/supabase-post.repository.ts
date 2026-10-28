import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { PostEntity } from '../domain/post.entity.js';
import type { NewPost, PostChanges, PostRepository } from '../domain/post.repository.js';

interface PostRow {
  id: string;
  forum_id: string;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
}

function toEntity(row: PostRow): PostEntity {
  return new PostEntity(
    row.id,
    row.forum_id,
    row.author_id,
    row.title,
    row.body,
    new Date(row.created_at),
  );
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

  async findByForumId(forumId: string): Promise<PostEntity[]> {
    const { data, error } = await this.supabase.client
      .from('posts')
      .select()
      .eq('forum_id', forumId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data as PostRow[]).map(toEntity);
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
