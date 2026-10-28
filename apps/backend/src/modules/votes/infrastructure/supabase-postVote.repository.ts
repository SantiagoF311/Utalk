import { Injectable } from '@nestjs/common';
import type { VoteValue } from '@utalk/shared';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { PostVoteEntity } from '../domain/postVote.entity.js';
import type { NewPostVote, PostVoteRepository } from '../domain/postVote.repository.js';

interface PostVoteRow {
  post_id: string;
  user_id: string;
  value: VoteValue;
  created_at: string;
}

function toEntity(row: PostVoteRow): PostVoteEntity {
  return new PostVoteEntity(row.post_id, row.user_id, row.value, new Date(row.created_at));
}

@Injectable()
export class SupabasePostVoteRepository implements PostVoteRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async upsert(vote: NewPostVote): Promise<PostVoteEntity> {
    const { data, error } = await this.supabase.client
      .from('post_votes')
      .upsert(
        {
          post_id: vote.postId,
          user_id: vote.userId,
          value: vote.value,
        },
        { onConflict: 'post_id,user_id' },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async delete(postId: string, userId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('post_votes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  }
}
