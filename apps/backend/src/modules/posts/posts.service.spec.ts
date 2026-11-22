import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
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
import type { ContentReviewService } from '../contentReview/contentReview.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PanelsService } from '../panels/panels.service.js';
import type { ProfilesService } from '../profiles/profiles.service.js';
import type { PostRepository } from './domain/post.repository.js';
import type { PostImageStorage } from './domain/postImage.storage.js';
import { PostsService } from './posts.service.js';

const notFound = (code: 'PROFILE_NOT_FOUND' | 'COMMUNITY_NOT_FOUND' | 'PANEL_NOT_FOUND') =>
  new AppException(code, 'not found');

// Los primeros bytes de un PNG real; el resto no importa para detectar el tipo.
const PNG = { content: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]) };
const NOT_AN_IMAGE = { content: new TextEncoder().encode('<script>alert(1)</script>') };
const PUBLIC_URL = 'https://storage.test/post-images/';

describe('PostsService', () => {
  let repository: jest.Mocked<PostRepository>;
  let profiles: {
    findById: jest.Mock<ProfilesService['findById']>;
    assertHistoryVisible: jest.Mock<ProfilesService['assertHistoryVisible']>;
  };
  let communities: { findById: jest.Mock<CommunitiesService['findById']> };
  let panels: { findById: jest.Mock<PanelsService['findById']> };
  let notifications: { enqueueNewPost: jest.Mock<NotificationsService['enqueueNewPost']> };
  let images: jest.Mocked<PostImageStorage>;
  let contentReview: { enqueuePost: jest.Mock<ContentReviewService['enqueuePost']> };
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
    contentReview = {
      enqueuePost: jest.fn<ContentReviewService['enqueuePost']>().mockResolvedValue(undefined),
    };
    images = {
      upload: jest.fn<PostImageStorage['upload']>().mockResolvedValue(undefined),
      delete: jest.fn<PostImageStorage['delete']>().mockResolvedValue(undefined),
      publicUrl: jest.fn<PostImageStorage['publicUrl']>((path) => `${PUBLIC_URL}${path}`),
    };

    service = new PostsService(
      repository,
      images,
      communities as unknown as CommunitiesService,
      panels as unknown as PanelsService,
      profiles as unknown as ProfilesService,
      notifications as unknown as NotificationsService,
      contentReview as unknown as ContentReviewService,
    );
  });

  describe('create', () => {
    const input = { communityId: IDS.community, title: 'Hola', body: 'Cuerpo' };

    it('crea el post y devuelve la vista con el autor y su universidad', async () => {
      const view = await service.create(input, IDS.ana);

      expect(repository.create).toHaveBeenCalledWith({
        ...input,
        authorId: IDS.ana,
        imagePath: null,
      });
      expect(view.imageUrl).toBeNull();
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

    it('con imagen: la sube en la carpeta del autor y guarda la ruta', async () => {
      repository.create.mockImplementation(async (newPost) => ({
        post: makePost({ imagePath: newPost.imagePath }),
        author: makeAuthor(),
      }));

      const view = await service.create(input, IDS.ana, PNG);

      const [path, content, type] = images.upload.mock.calls[0];
      expect(path).toMatch(new RegExp(`^${IDS.ana}/[0-9a-f-]{36}\\.png$`));
      expect(content).toBe(PNG.content);
      expect(type).toBe('image/png');
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ imagePath: path }));
      expect(view.imageUrl).toBe(`${PUBLIC_URL}${path}`);
    });

    it('INVALID_IMAGE si el archivo no es JPEG, PNG ni WebP, sin subir ni crear nada', async () => {
      await expect(service.create(input, IDS.ana, NOT_AN_IMAGE)).rejects.toMatchObject({
        code: 'INVALID_IMAGE',
      });
      expect(images.upload).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('no sube la imagen si no puede publicar en ese panel', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ universityId: IDS.otherUniversity }));

      await expect(service.create(input, IDS.beto, PNG)).rejects.toMatchObject({
        code: 'CANNOT_PUBLISH_IN_PANEL',
      });
      expect(images.upload).not.toHaveBeenCalled();
    });

    it('si el post no se pudo guardar, borra la imagen que ya subió', async () => {
      repository.create.mockRejectedValue(new Error('db down'));

      await expect(service.create(input, IDS.ana, PNG)).rejects.toThrow('db down');
      const [path] = images.upload.mock.calls[0];
      expect(images.delete).toHaveBeenCalledWith(path);
    });

    it('encola el aviso a los miembros de la comunidad', async () => {
      await service.create(input, IDS.ana);

      expect(notifications.enqueueNewPost).toHaveBeenCalledWith(IDS.post);
    });

    it('encola la revisión por IA (el post ya queda publicado)', async () => {
      const view = await service.create(input, IDS.ana);

      expect(contentReview.enqueuePost).toHaveBeenCalledWith(IDS.post);
      expect(view.id).toBe(IDS.post);
    });

    it('no encola la revisión si no pudo publicar', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ universityId: IDS.otherUniversity }));

      await expect(service.create(input, IDS.beto)).rejects.toBeDefined();
      expect(contentReview.enqueuePost).not.toHaveBeenCalled();
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

  describe('retenido por la IA', () => {
    const held = () => makePost({ heldAt: new Date() });

    it('nadie más lo puede abrir: POST_UNDER_REVIEW', async () => {
      repository.findWithAuthorById.mockResolvedValue({ post: held(), author: makeAuthor() });

      await expect(service.findViewById(IDS.post, IDS.beto)).rejects.toMatchObject({
        code: 'POST_UNDER_REVIEW',
      });
    });

    it('su autor lo ve, marcado "en revisión"', async () => {
      repository.findWithAuthorById.mockResolvedValue({ post: held(), author: makeAuthor() });

      const view = await service.findViewById(IDS.post, IDS.ana);

      expect(view.underReview).toBe(true);
    });

    it('no se comenta, vota ni reporta (findById), ni siquiera su autor', async () => {
      repository.findById.mockResolvedValue(held());

      await expect(service.findById(IDS.post)).rejects.toMatchObject({
        code: 'POST_UNDER_REVIEW',
      });
    });

    it('findVisibleById: su autor sí (ej. para ver los comentarios), el resto no', async () => {
      repository.findById.mockResolvedValue(held());

      await expect(service.findVisibleById(IDS.post, IDS.ana)).resolves.toBeDefined();
      await expect(service.findVisibleById(IDS.post, IDS.beto)).rejects.toMatchObject({
        code: 'POST_UNDER_REVIEW',
      });
    });

    it('su autor lo puede borrar', async () => {
      repository.findById.mockResolvedValue(held());

      await service.delete(IDS.post, IDS.ana);

      expect(repository.delete).toHaveBeenCalledWith(IDS.post);
    });

    it('solo aparece en el feed del perfil de su propio autor', async () => {
      repository.findPage.mockResolvedValue({ items: [], nextCursor: null });

      await service.findFeed({ authorId: IDS.ana, sort: 'new', limit: 20 }, IDS.ana);
      expect(repository.findPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ includeHeld: true }),
      );

      await service.findFeed({ authorId: IDS.ana, sort: 'new', limit: 20 }, IDS.beto);
      expect(repository.findPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ includeHeld: false }),
      );

      await service.findFeed({ communityId: IDS.community, sort: 'hot', limit: 20 }, IDS.ana);
      expect(repository.findPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ includeHeld: false }),
      );
    });

    it('un post normal no está en revisión', async () => {
      const view = await service.findViewById(IDS.post, IDS.beto);

      expect(view.underReview).toBe(false);
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

  describe('update: la IA revisa la versión editada', () => {
    it('al editar, encola otra revisión por IA', async () => {
      await service.update(IDS.post, { body: 'texto nuevo' }, IDS.ana);

      expect(repository.update).toHaveBeenCalledWith(IDS.post, {
        title: undefined,
        body: 'texto nuevo',
      });
      expect(contentReview.enqueuePost).toHaveBeenCalledWith(IDS.post);
    });

    it('si no puede editar, no encola nada', async () => {
      await expect(service.update(IDS.post, { body: 'x' }, IDS.beto)).rejects.toMatchObject({
        code: 'NOT_POST_AUTHOR',
      });
      expect(contentReview.enqueuePost).not.toHaveBeenCalled();
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

    it('borrar un post con imagen la saca del bucket', async () => {
      repository.findById.mockResolvedValue(makePost({ imagePath: `${IDS.ana}/foto.png` }));

      await service.delete(IDS.post, IDS.ana);

      expect(images.delete).toHaveBeenCalledWith(`${IDS.ana}/foto.png`);
    });

    it('si el bucket falla al borrar, el post igual queda borrado', async () => {
      repository.findById.mockResolvedValue(makePost({ imagePath: `${IDS.ana}/foto.png` }));
      images.delete.mockRejectedValue(new Error('storage down'));
      const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(service.delete(IDS.post, IDS.ana)).resolves.toBeUndefined();
      expect(repository.delete).toHaveBeenCalledWith(IDS.post);
      logError.mockRestore();
    });
  });

  describe('vista', () => {
    it('arma la URL pública de la imagen a partir de la ruta guardada', async () => {
      repository.findWithAuthorById.mockResolvedValue({
        post: makePost({ imagePath: `${IDS.ana}/foto.png` }),
        author: makeAuthor(),
      });

      const view = await service.findViewById(IDS.post, IDS.beto);

      expect(view.imageUrl).toBe(`${PUBLIC_URL}${IDS.ana}/foto.png`);
    });
  });
});
