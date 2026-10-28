import type { VoteValue } from '@utalk/shared';
import { PostVoteEntity } from './postVote.entity.js';

export interface NewPostVote {
  postId: string;
  userId: string;
  value: VoteValue;
}

export interface PostVoteRepository {
  // Crea el voto o cambia su valor si el usuario ya había votado ese post.
  upsert(vote: NewPostVote): Promise<PostVoteEntity>;
  delete(postId: string, userId: string): Promise<void>;
}

export const POST_VOTE_REPOSITORY = Symbol('POST_VOTE_REPOSITORY');
