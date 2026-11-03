import type { CommentVote, PostVote } from '@utalk/shared';
import type { CommentVoteEntity } from './domain/commentVote.entity.js';
import type { PostVoteEntity } from './domain/postVote.entity.js';

export function toPostVoteView(vote: PostVoteEntity): PostVote {
  return {
    postId: vote.postId,
    userId: vote.userId,
    value: vote.value,
    createdAt: vote.createdAt.toISOString(),
  };
}

export function toCommentVoteView(vote: CommentVoteEntity): CommentVote {
  return {
    commentId: vote.commentId,
    userId: vote.userId,
    value: vote.value,
    createdAt: vote.createdAt.toISOString(),
  };
}
