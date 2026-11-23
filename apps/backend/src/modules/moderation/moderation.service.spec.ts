import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReportCategory } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { IDS, makeComment, makeCommunity, makePost, makeProfile } from '../../testing/fixtures.js';
import type { CommentsService } from '../comments/comments.service.js';
import type { CommunitiesService } from '../communities/communities.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PostsService } from '../posts/posts.service.js';
import type { ProfilesService } from '../profiles/profiles.service.js';
import type { ContentClassifier } from './domain/contentClassifier.js';
import type { ModerationRepository } from './domain/moderation.repository.js';
import { ModerationCaseEntity } from './domain/moderationCase.entity.js';
import { ModerationService } from './moderation.service.js';

const COMMENT_ID = '00000000-0000-4000-8000-0000000000f1';
const OTHER_COMMUNITY = '00000000-0000-4000-8000-0000000000d2';

function makeCase(category: ReportCategory, firstReportedAt: string) {
  return new ModerationCaseEntity(
    { postId: IDS.post, commentId: null },
    IDS.post,
    IDS.community,
    'calculo',
    'Hola',
    'Cuerpo',
    { id: IDS.ana, username: 'ana' },
    false,
    1,
    [category],
    [],
    new Date(firstReportedAt),
    new Date(firstReportedAt),
    false,
    null,
  );
}

describe('ModerationService', () => {
  let repository: jest.Mocked<ModerationRepository>;
  let communities: {
    findModeratedBy: jest.Mock<CommunitiesService['findModeratedBy']>;
    canModerate: jest.Mock<CommunitiesService['canModerate']>;
  };
  let posts: {
    findByIdIncludingRemoved: jest.Mock<PostsService['findByIdIncludingRemoved']>;
    discardImage: jest.Mock<PostsService['discardImage']>;
    imageUrlFor: jest.Mock<PostsService['imageUrlFor']>;
  };
  let classifier: jest.Mocked<ContentClassifier>;
  let comments: { findById: jest.Mock<CommentsService['findById']> };
  let profiles: { findById: jest.Mock<ProfilesService['findById']> };
  let notifications: {
    enqueueModerationResult: jest.Mock<NotificationsService['enqueueModerationResult']>;
    push: jest.Mock<NotificationsService['push']>;
  };
  let service: ModerationService;

  beforeEach(() => {
    repository = {
      findPendingCases: jest.fn<ModerationRepository['findPendingCases']>().mockResolvedValue([]),
      resolve: jest.fn<ModerationRepository['resolve']>().mockResolvedValue(2),
      reportPostByAi: jest
        .fn<ModerationRepository['reportPostByAi']>()
        .mockResolvedValue({ reported: true, notificationId: IDS.notification }),
    };
    classifier = {
      classify: jest
        .fn<ContentClassifier['classify']>()
        .mockResolvedValue({ flagged: false, categories: [] }),
    };
    // Beto modera la comunidad del post de Ana.
    communities = {
      findModeratedBy: jest
        .fn<CommunitiesService['findModeratedBy']>()
        .mockResolvedValue([makeCommunity()]),
      canModerate: jest.fn<CommunitiesService['canModerate']>().mockResolvedValue(true),
    };
    posts = {
      findByIdIncludingRemoved: jest
        .fn<PostsService['findByIdIncludingRemoved']>()
        .mockResolvedValue(makePost()),
      discardImage: jest.fn<PostsService['discardImage']>().mockResolvedValue(undefined),
      imageUrlFor: jest.fn<PostsService['imageUrlFor']>((path) =>
        path ? `https://storage.test/${path}` : null,
      ),
    };
    comments = {
      findById: jest.fn<CommentsService['findById']>().mockResolvedValue(makeComment()),
    };
    profiles = {
      findById: jest
        .fn<ProfilesService['findById']>()
        .mockResolvedValue(makeProfile({ id: IDS.beto })),
    };
    notifications = {
      enqueueModerationResult: jest
        .fn<NotificationsService['enqueueModerationResult']>()
        .mockResolvedValue(undefined),
      push: jest.fn<NotificationsService['push']>().mockResolvedValue(undefined),
    };

    service = new ModerationService(
      repository,
      communities as unknown as CommunitiesService,
      posts as unknown as PostsService,
      comments as unknown as CommentsService,
      profiles as unknown as ProfilesService,
      notifications as unknown as NotificationsService,
      classifier,
    );
  });

  describe('reviewPost (moderación por IA)', () => {
    it('manda el título, el texto y la imagen del post', async () => {
      posts.findByIdIncludingRemoved.mockResolvedValue(
        makePost({ imagePath: `${IDS.ana}/foto.jpg` }),
      );

      await service.reviewPost(IDS.post);

      expect(classifier.classify).toHaveBeenCalledWith({
        text: 'Hola\n\nCuerpo',
        imageUrl: `https://storage.test/${IDS.ana}/foto.jpg`,
      });
    });

    it('si la IA lo marca, lo reporta (no lo elimina) con el motivo más grave', async () => {
      classifier.classify.mockResolvedValue({
        flagged: true,
        categories: ['harassment', 'violence'],
      });

      await expect(service.reviewPost(IDS.post)).resolves.toBe(true);

      expect(repository.reportPostByAi).toHaveBeenCalledWith(
        IDS.post,
        'threat',
        'Detectado por IA: acoso, violencia',
      );
      expect(repository.resolve).not.toHaveBeenCalled();
    });

    it('al retenerlo, el aviso al autor también va por push', async () => {
      classifier.classify.mockResolvedValue({ flagged: true, categories: ['harassment'] });

      await service.reviewPost(IDS.post);

      expect(notifications.push).toHaveBeenCalledWith([IDS.notification]);
    });

    it('en un reintento (el reporte ya existía) no hay aviso nuevo ni push', async () => {
      classifier.classify.mockResolvedValue({ flagged: true, categories: ['harassment'] });
      repository.reportPostByAi.mockResolvedValue({ reported: false, notificationId: null });

      await expect(service.reviewPost(IDS.post)).resolves.toBe(false);
      expect(notifications.push).not.toHaveBeenCalled();
    });

    it('si la IA no lo marca, no hace nada', async () => {
      await expect(service.reviewPost(IDS.post)).resolves.toBe(false);
      expect(repository.reportPostByAi).not.toHaveBeenCalled();
      expect(notifications.push).not.toHaveBeenCalled();
    });

    it('un post ya eliminado por un moderador no se revisa', async () => {
      posts.findByIdIncludingRemoved.mockResolvedValue(makePost({ removedAt: new Date() }));

      await expect(service.reviewPost(IDS.post)).resolves.toBe(false);
      expect(classifier.classify).not.toHaveBeenCalled();
    });

    it('uno ya retenido (ej. lo editaron mientras esperaba) no se vuelve a revisar', async () => {
      posts.findByIdIncludingRemoved.mockResolvedValue(makePost({ heldAt: new Date() }));

      await expect(service.reviewPost(IDS.post)).resolves.toBe(false);
      expect(classifier.classify).not.toHaveBeenCalled();
    });

    it('un post que su autor borró antes de la revisión no es un error', async () => {
      posts.findByIdIncludingRemoved.mockRejectedValue(
        new AppException('POST_NOT_FOUND', 'not found'),
      );

      await expect(service.reviewPost(IDS.post)).resolves.toBe(false);
      expect(classifier.classify).not.toHaveBeenCalled();
    });

    it('si falla la IA, el error sube para que BullMQ reintente', async () => {
      classifier.classify.mockRejectedValue(new Error('OpenAI 429'));

      await expect(service.reviewPost(IDS.post)).rejects.toThrow('OpenAI 429');
    });
  });

  describe('findScope', () => {
    it('dice si es admin y qué comunidades modera', async () => {
      const scope = await service.findScope(IDS.beto);

      expect(scope.isAdmin).toBe(false);
      expect(scope.communities.map((community) => community.id)).toEqual([IDS.community]);
    });
  });

  describe('findQueue', () => {
    it('un moderador ve la cola de todas sus comunidades', async () => {
      await service.findQueue({}, IDS.beto);
      expect(repository.findPendingCases).toHaveBeenCalledWith([IDS.community]);
    });

    it('un admin ve la de toda la plataforma', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ id: IDS.admin, role: 'admin' }));
      communities.findModeratedBy.mockResolvedValue([]);

      await service.findQueue({}, IDS.admin);
      expect(repository.findPendingCases).toHaveBeenCalledWith(null);
    });

    it('filtra por una comunidad que modera', async () => {
      await service.findQueue({ communityId: IDS.community }, IDS.beto);
      expect(repository.findPendingCases).toHaveBeenCalledWith([IDS.community]);
    });

    it('un admin puede filtrar por cualquier comunidad', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ id: IDS.admin, role: 'admin' }));
      communities.findModeratedBy.mockResolvedValue([]);

      await service.findQueue({ communityId: OTHER_COMMUNITY }, IDS.admin);
      expect(repository.findPendingCases).toHaveBeenCalledWith([OTHER_COMMUNITY]);
    });

    it('NOT_COMMUNITY_MODERATOR al pedir una comunidad que no modera', async () => {
      await expect(
        service.findQueue({ communityId: OTHER_COMMUNITY }, IDS.beto),
      ).rejects.toMatchObject({ code: 'NOT_COMMUNITY_MODERATOR' });
      expect(repository.findPendingCases).not.toHaveBeenCalled();
    });

    it('NOT_COMMUNITY_MODERATOR si no modera ninguna', async () => {
      communities.findModeratedBy.mockResolvedValue([]);

      await expect(service.findQueue({}, IDS.beto)).rejects.toMatchObject({
        code: 'NOT_COMMUNITY_MODERATOR',
      });
      expect(repository.findPendingCases).not.toHaveBeenCalled();
    });

    it('ordena por gravedad y después por antigüedad', async () => {
      const oldSpam = makeCase('spam', '2026-11-01T12:00:00.000Z');
      const newThreat = makeCase('threat', '2026-11-10T12:00:00.000Z');
      const oldHarassment = makeCase('harassment', '2026-11-02T12:00:00.000Z');
      const newSpam = makeCase('spam', '2026-11-09T12:00:00.000Z');
      repository.findPendingCases.mockResolvedValue([newSpam, oldSpam, oldHarassment, newThreat]);

      const queue = await service.findQueue({}, IDS.beto);

      expect(queue).toEqual([newThreat, oldHarassment, oldSpam, newSpam]);
    });
  });

  describe('resolve', () => {
    it('elimina un post reportado y devuelve cuántos reportes cerró', async () => {
      const resolved = await service.resolve(
        { postId: IDS.post, commentId: null, action: 'remove' },
        IDS.beto,
      );

      expect(resolved).toBe(2);
      expect(communities.canModerate).toHaveBeenCalledWith(IDS.community, IDS.beto);
      expect(repository.resolve).toHaveBeenCalledWith(
        { postId: IDS.post, commentId: null },
        'remove',
        IDS.beto,
      );
    });

    it('encola los avisos del contenido resuelto (post o comentario)', async () => {
      await service.resolve({ postId: IDS.post, commentId: null, action: 'remove' }, IDS.beto);
      expect(notifications.enqueueModerationResult).toHaveBeenLastCalledWith({
        postId: IDS.post,
        commentId: null,
      });

      await service.resolve({ postId: null, commentId: COMMENT_ID, action: 'dismiss' }, IDS.beto);
      expect(notifications.enqueueModerationResult).toHaveBeenLastCalledWith({
        postId: null,
        commentId: COMMENT_ID,
      });
    });

    it('no avisa nada si otro moderador ya lo había resuelto', async () => {
      repository.resolve.mockResolvedValue(0);

      await expect(
        service.resolve({ postId: IDS.post, commentId: null, action: 'remove' }, IDS.beto),
      ).rejects.toMatchObject({ code: 'NO_PENDING_REPORTS' });
      expect(notifications.enqueueModerationResult).not.toHaveBeenCalled();
    });

    it('no avisa nada si quien resuelve no modera esa comunidad', async () => {
      communities.canModerate.mockResolvedValue(false);

      await expect(
        service.resolve({ postId: IDS.post, commentId: null, action: 'remove' }, IDS.beto),
      ).rejects.toMatchObject({ code: 'NOT_COMMUNITY_MODERATOR' });
      expect(notifications.enqueueModerationResult).not.toHaveBeenCalled();
    });

    it('al eliminar un post, borra también su imagen', async () => {
      const post = makePost({ imagePath: `${IDS.ana}/foto.jpg` });
      posts.findByIdIncludingRemoved.mockResolvedValue(post);

      await service.resolve({ postId: IDS.post, commentId: null, action: 'remove' }, IDS.beto);

      expect(posts.discardImage).toHaveBeenCalledWith(post);
    });

    it('dejar un post no toca su imagen', async () => {
      await service.resolve({ postId: IDS.post, commentId: null, action: 'dismiss' }, IDS.beto);

      expect(posts.discardImage).not.toHaveBeenCalled();
    });

    it('eliminar un comentario no toca la imagen de su post', async () => {
      await service.resolve({ postId: null, commentId: COMMENT_ID, action: 'remove' }, IDS.beto);

      expect(posts.discardImage).not.toHaveBeenCalled();
    });

    it('si otro moderador se adelantó, no borra la imagen', async () => {
      repository.resolve.mockResolvedValue(0);

      await expect(
        service.resolve({ postId: IDS.post, commentId: null, action: 'remove' }, IDS.beto),
      ).rejects.toMatchObject({ code: 'NO_PENDING_REPORTS' });
      expect(posts.discardImage).not.toHaveBeenCalled();
    });

    it('descarta los reportes de un comentario, con la comunidad de su post', async () => {
      await service.resolve({ postId: null, commentId: COMMENT_ID, action: 'dismiss' }, IDS.beto);

      expect(comments.findById).toHaveBeenCalledWith(COMMENT_ID);
      expect(posts.findByIdIncludingRemoved).toHaveBeenCalledWith(IDS.post);
      expect(repository.resolve).toHaveBeenCalledWith(
        { postId: null, commentId: COMMENT_ID },
        'dismiss',
        IDS.beto,
      );
    });

    it('NOT_COMMUNITY_MODERATOR si no modera esa comunidad', async () => {
      communities.canModerate.mockResolvedValue(false);

      await expect(
        service.resolve({ postId: IDS.post, commentId: null, action: 'remove' }, IDS.beto),
      ).rejects.toMatchObject({ code: 'NOT_COMMUNITY_MODERATOR' });
      expect(repository.resolve).not.toHaveBeenCalled();
    });

    it('NO_PENDING_REPORTS si otro moderador se adelantó', async () => {
      repository.resolve.mockResolvedValue(0);

      await expect(
        service.resolve({ postId: IDS.post, commentId: null, action: 'remove' }, IDS.beto),
      ).rejects.toMatchObject({ code: 'NO_PENDING_REPORTS' });
    });

    it('propaga POST_NOT_FOUND si el post no existe', async () => {
      posts.findByIdIncludingRemoved.mockRejectedValue(
        new AppException('POST_NOT_FOUND', 'not found'),
      );

      await expect(
        service.resolve({ postId: IDS.post, commentId: null, action: 'dismiss' }, IDS.beto),
      ).rejects.toMatchObject({ code: 'POST_NOT_FOUND' });
      expect(repository.resolve).not.toHaveBeenCalled();
    });
  });
});
