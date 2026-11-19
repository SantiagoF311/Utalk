import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppException } from '../../common/appException.js';
import {
  IDS,
  makeAuthor,
  makeCommunity,
  makeGeneralPanel,
  makePanel,
  makePost,
  makeProfile,
} from '../../testing/fixtures.js';
import type { CommunitiesService } from '../communities/communities.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PanelsService } from '../panels/panels.service.js';
import type { ProfilesService } from '../profiles/profiles.service.js';
import type { PostRepository } from './domain/post.repository.js';
import { PostsService } from './posts.service.js';

const notFound = (code: 'PROFILE_NOT_FOUND' | 'COMMUNITY_NOT_FOUND' | 'PANEL_NOT_FOUND') =>
  new AppException(code, 'not found');

describe('PostsService', () => {
  let repository: jest.Mocked<PostRepository>;
  let profiles: {
    findById: jest.Mock<ProfilesService['findById']>;
    assertHistoryVisible: jest.Mock<ProfilesService['assertHistoryVisible']>;
  };
  let communities: { findById: jest.Mock<CommunitiesService['findById']> };
  let panels: { findById: jest.Mock<PanelsService['findById']> };
  let notifications: { enqueueNewPost: jest.Mock<NotificationsService['enqueueNewPost']> };
  let service: PostsService;

  beforeEach(() => {
    const post = makePost();
    repository = {
      create: jest.fn<PostRepository['create']>().mockResolvedValue({ post, author: makeAuthor() }),
      findById: jest.fn<PostRepository['findById']>().mockResolvedValue(post),
      findWithAuthorById: jest
        .fn<PostRepository['findWithAuthorById']>()
        .mockResolvedValue({ post, author: makeAuthor() }),
      findPage: jest.fn<PostRepository['findPage']>(),
      findVotesByUser: jest.fn<PostRepository['findVotesByUser']>().mockResolvedValue(new Map()),
      findReportedByUser: jest
        .fn<PostRepository['findReportedByUser']>()
        .mockResolvedValue(new Set()),
      update: jest.fn<PostRepository['update']>().mockResolvedValue(post),
      delete: jest.fn<PostRepository['delete']>().mockResolvedValue(undefined),
    };
    profiles = {
      findById: jest.fn<ProfilesService['findById']>().mockResolvedValue(makeProfile()),
      assertHistoryVisible: jest
        .fn<ProfilesService['assertHistoryVisible']>()
        .mockResolvedValue(undefined),
    };
    communities = {
      findById: jest.fn<CommunitiesService['findById']>().mockResolvedValue(makeCommunity()),
    };
    panels = { findById: jest.fn<PanelsService['findById']>().mockResolvedValue(makePanel()) };
    notifications = {
      enqueueNewPost: jest
        .fn<NotificationsService['enqueueNewPost']>()
        .mockResolvedValue(undefined),
    };

    service = new PostsService(
      repository,
      communities as unknown as CommunitiesService,
      panels as unknown as PanelsService,
      profiles as unknown as ProfilesService,
      notifications as unknown as NotificationsService,
    );
  });

  describe('create', () => {
    const input = { communityId: IDS.community, title: 'Hola', body: 'Cuerpo' };

    it('crea el post y devuelve la vista con el autor y su universidad', async () => {
      const view = await service.create(input, IDS.ana);

      expect(repository.create).toHaveBeenCalledWith({ ...input, authorId: IDS.ana });
      expect(view.author).toEqual(makeAuthor());
      expect(view.author.university.slug).toBe('ustavillavo');
      expect(view.score).toBe(0);
      expect(view.createdAt).toBe('2026-11-01T12:00:00.000Z');
    });

    it('un post recién creado no tiene voto propio ni reporte', async () => {
      const view = await service.create(input, IDS.ana);

      expect(view.myVote).toBeNull();
      expect(view.reportedByMe).toBe(false);
    });

    it('encola el aviso a los miembros de la comunidad', async () => {
      await service.create(input, IDS.ana);

      expect(notifications.enqueueNewPost).toHaveBeenCalledWith(IDS.post);
    });

    it('no encola nada si no puede publicar', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ universityId: IDS.otherUniversity }));

      await expect(service.create(input, IDS.beto)).rejects.toBeDefined();
      expect(notifications.enqueueNewPost).not.toHaveBeenCalled();
    });

    it('no relee el post ni busca su voto: el insert ya devuelve el autor', async () => {
      await service.create(input, IDS.ana);

      expect(repository.findWithAuthorById).not.toHaveBeenCalled();
      expect(repository.findVotesByUser).not.toHaveBeenCalled();
    });

    it('pide perfil y comunidad en paralelo', async () => {
      // Si fueran en secuencia, al pedir la comunidad el perfil ya se habría resuelto.
      let profileResolved = false;
      profiles.findById.mockImplementation(async () => {
        await Promise.resolve();
        profileResolved = true;
        return makeProfile();
      });
      communities.findById.mockImplementation(async () => {
        expect(profileResolved).toBe(false);
        return makeCommunity();
      });

      await service.create(input, IDS.ana);
      expect(communities.findById).toHaveBeenCalled();
    });

    it('rechaza postear en el panel de otra universidad', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ universityId: IDS.otherUniversity }));

      await expect(service.create(input, IDS.beto)).rejects.toMatchObject({
        code: 'CANNOT_PUBLISH_IN_PANEL',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('cualquier universidad puede postear en el panel general', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ universityId: IDS.otherUniversity }));
      panels.findById.mockResolvedValue(makeGeneralPanel());

      await expect(service.create(input, IDS.beto)).resolves.toBeDefined();
    });

    it('propaga PROFILE_NOT_FOUND si el autor no tiene perfil', async () => {
      profiles.findById.mockRejectedValue(notFound('PROFILE_NOT_FOUND'));

      await expect(service.create(input, IDS.ana)).rejects.toMatchObject({
        code: 'PROFILE_NOT_FOUND',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('propaga COMMUNITY_NOT_FOUND si la comunidad no existe', async () => {
      communities.findById.mockRejectedValue(notFound('COMMUNITY_NOT_FOUND'));

      await expect(service.create(input, IDS.ana)).rejects.toMatchObject({
        code: 'COMMUNITY_NOT_FOUND',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findFeed', () => {
    it('agrega el voto de quien mira a cada post', async () => {
      const upvoted = makePost({ id: '00000000-0000-4000-8000-0000000000e2' });
      repository.findPage.mockResolvedValue({
        items: [
          { post: makePost(), author: makeAuthor() },
          { post: upvoted, author: makeAuthor() },
        ],
        nextCursor: 'abc',
      });
      repository.findVotesByUser.mockResolvedValue(new Map([[upvoted.id, 1]]));

      const page = await service.findFeed(
        { communityId: IDS.community, sort: 'hot', limit: 20 },
        IDS.ana,
      );

      expect(page.items.map((p) => p.myVote)).toEqual([null, 1]);
      expect(page.nextCursor).toBe('abc');
    });

    it('marca los posts que quien mira ya reportó', async () => {
      const reported = makePost({ id: '00000000-0000-4000-8000-0000000000e2' });
      repository.findPage.mockResolvedValue({
        items: [
          { post: makePost(), author: makeAuthor() },
          { post: reported, author: makeAuthor() },
        ],
        nextCursor: null,
      });
      repository.findReportedByUser.mockResolvedValue(new Set([reported.id]));

      const page = await service.findFeed(
        { communityId: IDS.community, sort: 'hot', limit: 20 },
        IDS.beto,
      );

      expect(page.items.map((p) => p.reportedByMe)).toEqual([false, true]);
      expect(repository.findReportedByUser).toHaveBeenCalledWith([IDS.post, reported.id], IDS.beto);
    });

    it('404 explícito si la comunidad no existe, en vez de una página vacía', async () => {
      communities.findById.mockRejectedValue(notFound('COMMUNITY_NOT_FOUND'));

      await expect(
        service.findFeed({ communityId: IDS.community, sort: 'hot', limit: 20 }, IDS.ana),
      ).rejects.toMatchObject({
        code: 'COMMUNITY_NOT_FOUND',
      });
      expect(repository.findPage).not.toHaveBeenCalled();
    });
  });

  describe('findFeed por autor', () => {
    it('lista las publicaciones del autor si puede verse su historial', async () => {
      repository.findPage.mockResolvedValue({ items: [], nextCursor: null });

      await service.findFeed({ authorId: IDS.ana, sort: 'new', limit: 20 }, IDS.beto);

      expect(profiles.assertHistoryVisible).toHaveBeenCalledWith(IDS.ana, IDS.beto);
      expect(repository.findPage).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: IDS.ana }),
      );
    });

    it('no las lista si el perfil es privado', async () => {
      profiles.assertHistoryVisible.mockRejectedValue(
        new AppException('PROFILE_PRIVATE', 'private'),
      );

      await expect(
        service.findFeed({ authorId: IDS.ana, sort: 'new', limit: 20 }, IDS.beto),
      ).rejects.toMatchObject({ code: 'PROFILE_PRIVATE' });
      expect(repository.findPage).not.toHaveBeenCalled();
    });
  });

  describe('findViewById', () => {
    it('dice si quien mira ya lo reportó', async () => {
      repository.findReportedByUser.mockResolvedValue(new Set([IDS.post]));

      const view = await service.findViewById(IDS.post, IDS.beto);

      expect(view.reportedByMe).toBe(true);
    });

    it('POST_NOT_FOUND si no existe', async () => {
      repository.findWithAuthorById.mockResolvedValue(null);

      await expect(service.findViewById(IDS.post, IDS.ana)).rejects.toMatchObject({
        code: 'POST_NOT_FOUND',
      });
    });

    it('POST_REMOVED si lo eliminó la moderación', async () => {
      repository.findWithAuthorById.mockResolvedValue({
        post: makePost({ removedAt: new Date() }),
        author: makeAuthor(),
      });

      await expect(service.findViewById(IDS.post, IDS.ana)).rejects.toMatchObject({
        code: 'POST_REMOVED',
      });
    });
  });

  describe('findById / findByIdIncludingRemoved', () => {
    it('findById da POST_REMOVED para un post eliminado (no se comenta ni vota)', async () => {
      repository.findById.mockResolvedValue(makePost({ removedAt: new Date() }));

      await expect(service.findById(IDS.post)).rejects.toMatchObject({ code: 'POST_REMOVED' });
    });

    it('findByIdIncludingRemoved lo devuelve igual (para la moderación)', async () => {
      const removed = makePost({ removedAt: new Date() });
      repository.findById.mockResolvedValue(removed);

      await expect(service.findByIdIncludingRemoved(IDS.post)).resolves.toBe(removed);
    });
  });

  describe('update / delete', () => {
    it('solo el autor puede editar', async () => {
      await expect(service.update(IDS.post, { title: 'x' }, IDS.beto)).rejects.toMatchObject({
        code: 'NOT_POST_AUTHOR',
      });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('solo el autor puede borrar', async () => {
      await expect(service.delete(IDS.post, IDS.beto)).rejects.toMatchObject({
        code: 'NOT_POST_AUTHOR',
      });
      await service.delete(IDS.post, IDS.ana);
      expect(repository.delete).toHaveBeenCalledWith(IDS.post);
    });
  });
});
