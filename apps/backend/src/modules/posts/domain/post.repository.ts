import { PostEntity } from './post.entity.js';

export interface NewPost {
  forumId: string;
  authorId: string;
  title: string;
  body: string;
}

export interface PostChanges {
  title?: string;
  body?: string;
}

export interface PostRepository {
  create(post: NewPost): Promise<PostEntity>;
  findById(id: string): Promise<PostEntity | null>;
  findByForumId(forumId: string): Promise<PostEntity[]>;
  update(id: string, changes: PostChanges): Promise<PostEntity>;
  delete(id: string): Promise<void>;
}

export const POST_REPOSITORY = Symbol('POST_REPOSITORY');
