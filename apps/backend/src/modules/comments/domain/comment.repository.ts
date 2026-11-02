import type { Author, VoteValue } from '@utalk/shared';
import { CommentEntity } from './comment.entity.js';

export interface NewComment {
  postId: string;
  parentId: string | null;
  authorId: string;
  body: string;
}

export interface CommentChanges {
  body: string;
}

export interface CommentWithAuthor {
  comment: CommentEntity;
  author: Author;
}

export interface CommentRepository {
  create(comment: NewComment): Promise<CommentEntity>;
  findById(id: string): Promise<CommentEntity | null>;
  findWithAuthorById(id: string): Promise<CommentWithAuthor | null>;
  // Lista plana de todo el post (incluidos los borrados); el árbol lo arma el service.
  findWithAuthorByPostId(postId: string): Promise<CommentWithAuthor[]>;
  // Voto del usuario en cada uno de esos comentarios; los que no votó no aparecen.
  findVotesByUser(commentIds: string[], userId: string): Promise<Map<string, VoteValue>>;
  update(id: string, changes: CommentChanges): Promise<CommentEntity>;
  softDelete(id: string): Promise<void>;
}

export const COMMENT_REPOSITORY = Symbol('COMMENT_REPOSITORY');
