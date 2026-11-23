import { Inject, Injectable } from '@nestjs/common';
import type { ModerationQueueQuery, ResolveReportsInput } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { CommentsService } from '../comments/comments.service.js';
import { CommunitiesService } from '../communities/communities.service.js';
import type { CommunityEntity } from '../communities/domain/community.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { PostEntity } from '../posts/domain/post.entity.js';
import { PostsService } from '../posts/posts.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import type { ReportTarget } from '../reports/domain/report.repository.js';
import { aiReportFor } from './domain/aiReport.js';
import { CONTENT_CLASSIFIER } from './domain/contentClassifier.js';
import type { ContentClassifier } from './domain/contentClassifier.js';
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
    private readonly notificationsService: NotificationsService,
    @Inject(CONTENT_CLASSIFIER) private readonly contentClassifier: ContentClassifier,
  ) {}

  // Lo corre el worker de la cola `moderation` con cada post nuevo. Si la IA
  // lo marca, crea un reporte automático y queda en la cola para un
  // moderador: la IA no elimina nada. Devuelve si lo reportó.
  async reviewPost(postId: string): Promise<boolean> {
    let post: PostEntity;
    try {
      post = await this.postsService.findByIdIncludingRemoved(postId);
    } catch (error) {
      // Su autor lo borró antes de que llegara la revisión: nada que revisar.
      if (error instanceof AppException && error.code === 'POST_NOT_FOUND') return false;
      throw error;
    }
    // Ya lo eliminó un moderador, o ya está retenido esperando a uno (la
    // revisión de una edición mientras tanto no cambiaría nada).
    if (post.isRemoved() || post.isHeld()) return false;

    const classification = await this.contentClassifier.classify({
      text: `${post.title}\n\n${post.body}`,
      imageUrl: this.postsService.imageUrlFor(post.imagePath),
    });
    if (!classification.flagged) return false;

    const { category, reason } = aiReportFor(classification.categories);
    const { reported, notificationId } = await this.moderationRepository.reportPostByAi(
      post.id,
      category,
      reason,
    );
    // El aviso al autor de que quedó retenido también le llega por push.
    if (notificationId !== null) {
      await this.notificationsService.push([notificationId]);
    }
    return reported;
  }

  // La imagen del post de un caso, para que el moderador la vea.
  imageUrlOf(entry: ModerationCaseEntity): string | null {
    return this.postsService.imageUrlFor(entry.postImagePath);
  }

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
    const { target, post } = await this.resolveTarget(input);
    const communityId = post.communityId;
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
    // Eliminar un post se lleva su imagen del bucket (un comentario no toca
    // la imagen de su post).
    if (input.action === 'remove' && target.postId !== null) {
      await this.postsService.discardImage(post);
    }
    // Avisar a quienes reportaron (y al autor, si se eliminó) lo hace el
    // worker después; acá solo se encola.
    await this.notificationsService.enqueueModerationResult(target);
    return resolved;
  }

  // El contenido y su post (cuya comunidad define quién lo modera). El post
  // se busca aunque ya esté eliminado: así un segundo intento da
  // NO_PENDING_REPORTS y no un "no existe".
  private async resolveTarget(
    input: ResolveReportsInput,
  ): Promise<{ target: ReportTarget; post: PostEntity }> {
    if (input.postId !== null && input.commentId === null) {
      const post = await this.postsService.findByIdIncludingRemoved(input.postId);
      return { target: { postId: input.postId, commentId: null }, post };
    }
    if (input.commentId !== null && input.postId === null) {
      const comment = await this.commentsService.findById(input.commentId);
      const post = await this.postsService.findByIdIncludingRemoved(comment.postId);
      return { target: { postId: null, commentId: input.commentId }, post };
    }
    throw new AppException('VALIDATION_FAILED', 'Exactly one of postId or commentId must be set');
  }
}
