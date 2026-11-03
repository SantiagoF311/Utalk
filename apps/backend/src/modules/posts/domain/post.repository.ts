import type { Author, PostSort, VoteValue } from '@utalk/shared';
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

export interface PostWithAuthor {
  post: PostEntity;
  author: Author;
}

// Exactamente uno de forumId/panelId (lo garantiza postFeedQuerySchema).
export interface PostPageQuery {
  forumId?: string;
  panelId?: string;
  sort: PostSort;
  cursor?: string;
  limit: number;
}

export interface PostPage {
  items: PostWithAuthor[];
  nextCursor: string | null;
}

export interface PostRepository {
  // Devuelve el post ya con su autor (mismo viaje a la base que el insert).
  create(post: NewPost): Promise<PostWithAuthor>;
  findById(id: string): Promise<PostEntity | null>;
  findWithAuthorById(id: string): Promise<PostWithAuthor | null>;
  findPage(query: PostPageQuery): Promise<PostPage>;
  // Voto del usuario en cada uno de esos posts; los que no votó no aparecen.
  findVotesByUser(postIds: string[], userId: string): Promise<Map<string, VoteValue>>;
  update(id: string, changes: PostChanges): Promise<PostEntity>;
  delete(id: string): Promise<void>;
}

export const POST_REPOSITORY = Symbol('POST_REPOSITORY');
