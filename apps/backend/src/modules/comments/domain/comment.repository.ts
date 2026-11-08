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
  // Devuelve el comentario ya con su autor (mismo viaje a la base que el insert).
  create(comment: NewComment): Promise<CommentWithAuthor>;
  findById(id: string): Promise<CommentEntity | null>;
  findWithAuthorById(id: string): Promise<CommentWithAuthor | null>;
  // Lista plana de todo el post (incluidos los borrados); el árbol lo arma el service.
  findWithAuthorByPostId(postId: string): Promise<CommentWithAuthor[]>;
  // Voto del usuario en cada uno de esos comentarios; los que no votó no aparecen.
  findVotesByUser(commentIds: string[], userId: string): Promise<Map<string, VoteValue>>;
  // Cuáles de esos comentarios reportó el usuario (la app los muestra ocultos).
  findReportedByUser(commentIds: string[], userId: string): Promise<Set<string>>;
  // Comentarios (no borrados) de un autor, del más nuevo al más viejo, con el
  // título de su publicación. Paginado por cursor.
  findPageByAuthor(query: AuthorCommentPageQuery): Promise<AuthorCommentPage>;
  update(id: string, changes: CommentChanges): Promise<CommentEntity>;
  softDelete(id: string): Promise<void>;
}

export interface AuthorCommentPageQuery {
  authorId: string;
  cursor?: string;
  limit: number;
}

export interface CommentWithPostTitle {
  comment: CommentEntity;
  postTitle: string;
}

export interface AuthorCommentPage {
  items: CommentWithPostTitle[];
  nextCursor: string | null;
}

export const COMMENT_REPOSITORY = Symbol('COMMENT_REPOSITORY');
