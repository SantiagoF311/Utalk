import type { VoteValue } from '@utalk/shared';
import { CommentVoteEntity } from './commentVote.entity.js';

export interface NewCommentVote {
  commentId: string;
  userId: string;
  value: VoteValue;
}

export interface CommentVoteRepository {
  // Crea el voto o cambia su valor si el usuario ya había votado ese comentario.
  upsert(vote: NewCommentVote): Promise<CommentVoteEntity>;
  delete(commentId: string, userId: string): Promise<void>;
}

export const COMMENT_VOTE_REPOSITORY = Symbol('COMMENT_VOTE_REPOSITORY');
