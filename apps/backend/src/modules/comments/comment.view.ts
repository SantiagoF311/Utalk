import type { CommentView, ProfileComment, VoteValue } from '@utalk/shared';
import type { CommentWithAuthor, CommentWithPostTitle } from './domain/comment.repository.js';

// Un comentario en el perfil de su autor: con el título de su publicación.
export function toProfileCommentView({ comment, postTitle }: CommentWithPostTitle): ProfileComment {
  return {
    id: comment.id,
    postId: comment.postId,
    postTitle,
    body: comment.body,
    score: comment.score,
    createdAt: comment.createdAt.toISOString(),
  };
}

// Un comentario borrado se devuelve sin autor ni texto: la app lo muestra
// como "[eliminado]" y conserva sus respuestas. `myVote` y `reportedByMe`
// dependen de quien mira, no del comentario.
export function toCommentView(
  { comment, author }: CommentWithAuthor,
  myVote: VoteValue | null,
  reportedByMe: boolean,
): CommentView {
  const isDeleted = comment.isDeleted();
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    author: isDeleted ? null : author,
    body: isDeleted ? null : comment.body,
    isDeleted,
    isRemoved: comment.isRemoved(),
    score: comment.score,
    myVote,
    reportedByMe,
    createdAt: comment.createdAt.toISOString(),
    replies: [],
  };
}
