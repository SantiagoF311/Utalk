export interface ForumModeratorRepository {
  isModerator(forumId: string, userId: string): Promise<boolean>;
}

export const FORUM_MODERATOR_REPOSITORY = Symbol('FORUM_MODERATOR_REPOSITORY');
