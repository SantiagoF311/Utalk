import { Injectable } from '@nestjs/common';
import type { VoteValue } from '@utalk/shared';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { CommentVoteEntity } from '../domain/commentVote.entity.js';
import type { CommentVoteRepository, NewCommentVote } from '../domain/commentVote.repository.js';

interface CommentVoteRow {
  comment_id: string;
  user_id: string;
  value: VoteValue;
  created_at: string;
}

function toEntity(row: CommentVoteRow): CommentVoteEntity {
  return new CommentVoteEntity(row.comment_id, row.user_id, row.value, new Date(row.created_at));
}

@Injectable()
export class SupabaseCommentVoteRepository implements CommentVoteRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async upsert(vote: NewCommentVote): Promise<CommentVoteEntity> {
    const { data, error } = await this.supabase.client
      .from('comment_votes')
      .upsert(
        {
          comment_id: vote.commentId,
          user_id: vote.userId,
          value: vote.value,
        },
        { onConflict: 'comment_id,user_id' },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async delete(commentId: string, userId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('comment_votes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  }
}
