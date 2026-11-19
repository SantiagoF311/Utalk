import type { PostView, VoteValue } from '@utalk/shared';
import type { PostWithAuthor } from './domain/post.repository.js';

// `myVote` y `reportedByMe` dependen de quien mira, no del post. `imageUrl`
// la arma el almacenamiento a partir de la ruta guardada.
export function toPostView(
  { post, author }: PostWithAuthor,
  myVote: VoteValue | null,
  reportedByMe: boolean,
  imageUrl: string | null,
): PostView {
  return {
    id: post.id,
    communityId: post.communityId,
    title: post.title,
    body: post.body,
    score: post.score,
    commentCount: post.commentCount,
    createdAt: post.createdAt.toISOString(),
    author,
    myVote,
    reportedByMe,
    imageUrl,
  };
}
