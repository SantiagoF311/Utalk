import type { BlockedUser } from '@utalk/shared';
import type { BlockWithUser } from './domain/block.repository.js';

export function toBlockedUserView({ block, user }: BlockWithUser): BlockedUser {
  return { user, blockedAt: block.createdAt.toISOString() };
}
