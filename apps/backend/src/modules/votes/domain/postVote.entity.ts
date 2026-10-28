import type { VoteValue } from '@utalk/shared';

export class PostVoteEntity {
  constructor(
    readonly postId: string,
    readonly userId: string,
    readonly value: VoteValue,
    readonly createdAt: Date,
  ) {}

  isUpvote(): boolean {
    return this.value === 1;
  }
}
