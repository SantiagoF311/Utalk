import { Inject, Injectable } from '@nestjs/common';
import type { ModerationQueueQuery, ResolveReportsInput } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { CommentsService } from '../comments/comments.service.js';
import { CommunitiesService } from '../communities/communities.service.js';
import type { CommunityEntity } from '../communities/domain/community.entity.js';
import { PostsService } from '../posts/posts.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import type { ReportTarget } from '../reports/domain/report.repository.js';
import { MODERATION_REPOSITORY } from './domain/moderation.repository.js';
import type { ModerationRepository } from './domain/moderation.repository.js';
import { ModerationCaseEntity } from './domain/moderationCase.entity.js';

export interface ModerationScope {
  isAdmin: boolean;
  // Donde es moderador. Un admin modera todas aunque esta lista esté vacía.
  communities: CommunityEntity[];
}

@Injectable()
export class ModerationService {
  constructor(
    @Inject(MODERATION_REPOSITORY) private readonly moderationRepository: ModerationRepository,
    private readonly communitiesService: CommunitiesService,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async findScope(userId: string): Promise<ModerationScope> {
    const [profile, communities] = await Promise.all([
      this.profilesService.findById(userId),
      this.communitiesService.findModeratedBy(userId),
    ]);
    return { isAdmin: profile.isAdmin(), communities };
  }

  // La cola de quien pregunta: la de una comunidad que modera, o la de todas
  // las que modera (un admin, todas las de la plataforma).
  async findQueue(query: ModerationQueueQuery, userId: string): Promise<ModerationCaseEntity[]> {
    const scope = await this.findScope(userId);
    const moderated = scope.communities.map((community) => community.id);

    let communityIds: string[] | null;
    if (query.communityId !== undefined) {
      if (!scope.isAdmin && !moderated.includes(query.communityId)) {
        throw new AppException(
          'NOT_COMMUNITY_MODERATOR',
          `You do not moderate community ${query.communityId}`,
        );
      }
      communityIds = [query.communityId];
    } else if (scope.isAdmin) {
      communityIds = null;
    } else if (moderated.length > 0) {
      communityIds = moderated;
    } else {
      throw new AppException('NOT_COMMUNITY_MODERATOR', 'You do not moderate any community');
    }

    const cases = await this.moderationRepository.findPendingCases(communityIds);
    return cases.sort((a, b) => a.compareTo(b));
  }

  // Resuelve todos los reportes pendientes de un contenido (eliminarlo o
  // dejarlo). Devuelve cuántos reportes cerró.
  async resolve(input: ResolveReportsInput, userId: string): Promise<number> {
    const { target, communityId } = await this.resolveTarget(input);
    if (!(await this.communitiesService.canModerate(communityId, userId))) {
      throw new AppException(
        'NOT_COMMUNITY_MODERATOR',
        `You do not moderate community ${communityId}`,
      );
    }

    const resolved = await this.moderationRepository.resolve(target, input.action, userId);
    // Otro moderador se adelantó (o nunca lo reportaron): sin un reporte
    // pendiente que lo justifique, el contenido no se toca.
    if (resolved === 0) {
      throw new AppException('NO_PENDING_REPORTS', 'This content has no pending reports');
    }
    return resolved;
  }

  // El contenido y la comunidad donde está (la que define quién lo modera).
  // El post se busca aunque ya esté eliminado: así un segundo intento da
  // NO_PENDING_REPORTS y no un "no existe".
  private async resolveTarget(
    input: ResolveReportsInput,
  ): Promise<{ target: ReportTarget; communityId: string }> {
    if (input.postId !== null && input.commentId === null) {
      const post = await this.postsService.findByIdIncludingRemoved(input.postId);
      return { target: { postId: input.postId, commentId: null }, communityId: post.communityId };
    }
    if (input.commentId !== null && input.postId === null) {
      const comment = await this.commentsService.findById(input.commentId);
      const post = await this.postsService.findByIdIncludingRemoved(comment.postId);
      return {
        target: { postId: null, commentId: input.commentId },
        communityId: post.communityId,
      };
    }
    throw new AppException('VALIDATION_FAILED', 'Exactly one of postId or commentId must be set');
  }
}
