import type { CommentView, VoteValue } from '@utalk/shared';
import type { CommentWithAuthor } from './domain/comment.repository.js';

// Un comentario borrado se devuelve sin autor ni texto: la app lo muestra
// como "[eliminado]" y conserva sus respuestas.
export function toCommentView(
  { comment, author }: CommentWithAuthor,
  myVote: VoteValue | null,
): CommentView {
  const isDeleted = comment.isDeleted();
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    author: isDeleted ? null : author,
    body: isDeleted ? null : comment.body,
    isDeleted,
    score: comment.score,
    myVote,
    createdAt: comment.createdAt.toISOString(),
    replies: [],
  };
}
