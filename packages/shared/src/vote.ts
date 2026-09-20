import { z } from 'zod';

export const voteValueSchema = z.union([z.literal(1), z.literal(-1)]);

export type VoteValue = z.infer<typeof voteValueSchema>;

export const postVoteSchema = z.object({
  postId: z.uuid(),
  userId: z.uuid(),
  value: voteValueSchema,
  createdAt: z.iso.datetime(),
});

export type PostVote = z.infer<typeof postVoteSchema>;

export const commentVoteSchema = z.object({
  commentId: z.uuid(),
  userId: z.uuid(),
  value: voteValueSchema,
  createdAt: z.iso.datetime(),
});

export type CommentVote = z.infer<typeof commentVoteSchema>;

export const castPostVoteSchema = z.object({
  postId: z.uuid(),
  value: voteValueSchema,
});

export type CastPostVoteInput = z.infer<typeof castPostVoteSchema>;

export const castCommentVoteSchema = z.object({
  commentId: z.uuid(),
  value: voteValueSchema,
});

export type CastCommentVoteInput = z.infer<typeof castCommentVoteSchema>;
