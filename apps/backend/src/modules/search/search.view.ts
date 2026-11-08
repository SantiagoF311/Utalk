import type { SearchResult } from '@utalk/shared';
import type { SearchHitEntity } from './domain/searchHit.entity.js';

export function toSearchResultView(hit: SearchHitEntity): SearchResult {
  if (hit.isPost()) {
    return {
      kind: 'post',
      id: hit.id,
      communityId: hit.communityId,
      title: hit.postTitle,
      body: hit.body,
      score: hit.score,
      commentCount: hit.commentCount ?? 0,
      author: hit.author,
      createdAt: hit.createdAt.toISOString(),
    };
  }
  return {
    kind: 'comment',
    id: hit.id,
    postId: hit.postId,
    postTitle: hit.postTitle,
    body: hit.body,
    score: hit.score,
    author: hit.author,
    createdAt: hit.createdAt.toISOString(),
  };
}
