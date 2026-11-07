export interface CommunityModeratorRepository {
  isModerator(communityId: string, userId: string): Promise<boolean>;
}

export const COMMUNITY_MODERATOR_REPOSITORY = Symbol('COMMUNITY_MODERATOR_REPOSITORY');
