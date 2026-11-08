export interface CommunityMemberRepository {
  // Idempotentes: unirse dos veces o salirse sin estar no son errores (el
  // botón de la app puede mandar dos toques seguidos).
  add(communityId: string, userId: string): Promise<void>;
  remove(communityId: string, userId: string): Promise<void>;
  // Cuáles de esas comunidades tienen al usuario como miembro.
  findJoinedByUser(communityIds: string[], userId: string): Promise<Set<string>>;
}

export const COMMUNITY_MEMBER_REPOSITORY = Symbol('COMMUNITY_MEMBER_REPOSITORY');
