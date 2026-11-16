import type { ModerationCase, ModerationScope as ModerationScopeView } from '@utalk/shared';
import type { ModerationCaseEntity } from './domain/moderationCase.entity.js';
import type { ModerationScope } from './moderation.service.js';

export function toModerationScopeView(scope: ModerationScope): ModerationScopeView {
  return {
    isAdmin: scope.isAdmin,
    communities: scope.communities.map(({ id, slug, name }) => ({ id, slug, name })),
  };
}

export function toModerationCaseView(entry: ModerationCaseEntity): ModerationCase {
  return {
    postId: entry.postId,
    postTitle: entry.postTitle,
    commentId: entry.target.commentId,
    community: { id: entry.communityId, slug: entry.communitySlug },
    body: entry.body,
    author: entry.author,
    isDeleted: entry.isDeleted,
    reportCount: entry.reportCount,
    categories: entry.categories,
    reasons: entry.reasons,
    firstReportedAt: entry.firstReportedAt.toISOString(),
    lastReportedAt: entry.lastReportedAt.toISOString(),
  };
}
