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

export interface CommentRepository {
  create(comment: NewComment): Promise<CommentEntity>;
  findById(id: string): Promise<CommentEntity | null>;
  findByPostId(postId: string): Promise<CommentEntity[]>;
  update(id: string, changes: CommentChanges): Promise<CommentEntity>;
  delete(id: string): Promise<void>;
}

export const COMMENT_REPOSITORY = Symbol('COMMENT_REPOSITORY');
