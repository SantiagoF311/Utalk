import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppException } from '../../common/appException.js';
import { IDS, makeAuthor, makeComment, makePost, makeProfile } from '../../testing/fixtures.js';
import type { PostsService } from '../posts/posts.service.js';
import type { ProfilesService } from '../profiles/profiles.service.js';
import { CommentsService } from './comments.service.js';
import type { CommentEntity } from './domain/comment.entity.js';
import type { CommentRepository, CommentWithAuthor } from './domain/comment.repository.js';

const id = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;
const at = (minute: number) => new Date(`2026-11-01T12:${String(minute).padStart(2, '0')}:00.000Z`);
const withAuthor = (comment: CommentEntity): CommentWithAuthor => ({
  comment,
  author: makeAuthor(),
});

describe('CommentsService', () => {
  let repository: jest.Mocked<CommentRepository>;
  let profiles: {
    findById: jest.Mock<ProfilesService['findById']>;
    assertHistoryVisible: jest.Mock<ProfilesService['assertHistoryVisible']>;
  };
  let service: CommentsService;

  beforeEach(() => {
    repository = {
      create: jest.fn<CommentRepository['create']>().mockResolvedValue(withAuthor(makeComment())),
      findById: jest.fn<CommentRepository['findById']>().mockResolvedValue(makeComment()),
      findWithAuthorById: jest.fn<CommentRepository['findWithAuthorById']>(),
      findWithAuthorByPostId: jest
        .fn<CommentRepository['findWithAuthorByPostId']>()
        .mockResolvedValue([]),
      findVotesByUser: jest.fn<CommentRepository['findVotesByUser']>().mockResolvedValue(new Map()),
      findReportedByUser: jest
        .fn<CommentRepository['findReportedByUser']>()
        .mockResolvedValue(new Set()),
      findPageByAuthor: jest
        .fn<CommentRepository['findPageByAuthor']>()
        .mockResolvedValue({ items: [], nextCursor: null }),
      update: jest.fn<CommentRepository['update']>(),
      softDelete: jest.fn<CommentRepository['softDelete']>().mockResolvedValue(undefined),
    };
    const posts = { findById: jest.fn<PostsService['findById']>().mockResolvedValue(makePost()) };
    profiles = {
      findById: jest.fn<ProfilesService['findById']>().mockResolvedValue(makeProfile()),
      assertHistoryVisible: jest
        .fn<ProfilesService['assertHistoryVisible']>()
        .mockResolvedValue(undefined),
    };

    service = new CommentsService(
      repository,
      posts as unknown as PostsService,
      profiles as unknown as ProfilesService,
    );
  });

  describe('findPageByAuthor', () => {
    it('devuelve los comentarios del autor con el título de su publicación', async () => {
      repository.findPageByAuthor.mockResolvedValue({
        items: [{ comment: makeComment(), postTitle: 'Sala de estudio' }],
        nextCursor: 'abc',
      });

      const page = await service.findPageByAuthor(IDS.ana, { limit: 20 }, IDS.beto);

      expect(page.items[0]).toMatchObject({ postId: IDS.post, postTitle: 'Sala de estudio' });
      expect(page.nextCursor).toBe('abc');
      expect(profiles.assertHistoryVisible).toHaveBeenCalledWith(IDS.ana, IDS.beto);
    });

    it('no los lista si el perfil es privado', async () => {
      profiles.assertHistoryVisible.mockRejectedValue(
        new AppException('PROFILE_PRIVATE', 'private'),
      );

      await expect(
        service.findPageByAuthor(IDS.ana, { limit: 20 }, IDS.beto),
      ).rejects.toMatchObject({ code: 'PROFILE_PRIVATE' });
      expect(repository.findPageByAuthor).not.toHaveBeenCalled();
    });
  });

  describe('findTreeByPostId', () => {
    it('marca los comentarios que quien mira ya reportó, también entre las respuestas', async () => {
      repository.findWithAuthorByPostId.mockResolvedValue([
        withAuthor(makeComment({ id: id(1), createdAt: at(1) })),
        withAuthor(makeComment({ id: id(2), parentId: id(1), createdAt: at(2) })),
      ]);
      repository.findReportedByUser.mockResolvedValue(new Set([id(2)]));

      const tree = await service.findTreeByPostId(IDS.post, IDS.beto);

      expect(tree[0].reportedByMe).toBe(false);
      expect(tree[0].replies[0].reportedByMe).toBe(true);
    });

    it('arma el árbol: cada respuesta dentro de su padre, en varios niveles', async () => {
      repository.findWithAuthorByPostId.mockResolvedValue([
        withAuthor(makeComment({ id: id(1), createdAt: at(1) })),
        withAuthor(makeComment({ id: id(2), parentId: id(1), createdAt: at(2) })),
        withAuthor(makeComment({ id: id(3), parentId: id(2), createdAt: at(3) })),
      ]);

      const tree = await service.findTreeByPostId(IDS.post, IDS.ana);

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(id(1));
      expect(tree[0].replies[0].id).toBe(id(2));
      expect(tree[0].replies[0].replies[0].id).toBe(id(3));
    });

    it('ordena por score y, a igual score, el más antiguo primero', async () => {
      repository.findWithAuthorByPostId.mockResolvedValue([
        withAuthor(makeComment({ id: id(1), score: 1, createdAt: at(1) })),
        withAuthor(makeComment({ id: id(2), score: 5, createdAt: at(2) })),
        withAuthor(makeComment({ id: id(3), score: 1, createdAt: at(0) })),
      ]);

      const tree = await service.findTreeByPostId(IDS.post, IDS.ana);

      expect(tree.map((c) => c.id)).toEqual([id(2), id(3), id(1)]);
    });

    it('un comentario borrado conserva su lugar y sus respuestas, sin autor ni texto', async () => {
      repository.findWithAuthorByPostId.mockResolvedValue([
        withAuthor(makeComment({ id: id(1), deletedAt: at(9) })),
        withAuthor(makeComment({ id: id(2), parentId: id(1) })),
      ]);

      const [deleted] = await service.findTreeByPostId(IDS.post, IDS.ana);

      expect(deleted).toMatchObject({ isDeleted: true, author: null, body: null });
      expect(deleted.replies[0].id).toBe(id(2));
      expect(deleted.replies[0].body).toBe('texto');
    });

    it('agrega el voto de quien mira', async () => {
      repository.findWithAuthorByPostId.mockResolvedValue([withAuthor(makeComment({ id: id(1) }))]);
      repository.findVotesByUser.mockResolvedValue(new Map([[id(1), -1]]));

      const [comment] = await service.findTreeByPostId(IDS.post, IDS.ana);

      expect(comment.myVote).toBe(-1);
    });
  });

  describe('create', () => {
    const input = { postId: IDS.post, parentId: null, body: 'hola' };

    it('devuelve la vista con autor, sin voto propio y sin releer', async () => {
      const view = await service.create(input, IDS.ana);

      expect(view.author).toEqual(makeAuthor());
      expect(view.myVote).toBeNull();
      expect(repository.findWithAuthorById).not.toHaveBeenCalled();
    });

    it('no se puede responder a un comentario borrado', async () => {
      repository.findById.mockResolvedValue(makeComment({ id: id(1), deletedAt: at(9) }));

      await expect(service.create({ ...input, parentId: id(1) }, IDS.ana)).rejects.toMatchObject({
        code: 'COMMENT_DELETED',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('el padre tiene que ser del mismo post', async () => {
      repository.findById.mockResolvedValue(
        makeComment({ id: id(1), postId: '00000000-0000-4000-8000-0000000000e9' }),
      );

      await expect(service.create({ ...input, parentId: id(1) }, IDS.ana)).rejects.toMatchObject({
        code: 'PARENT_COMMENT_MISMATCH',
      });
    });
  });

  describe('update / delete', () => {
    it('editar un comentario borrado da COMMENT_DELETED (no "no eres el autor")', async () => {
      repository.findById.mockResolvedValue(makeComment({ deletedAt: at(9) }));

      await expect(service.update(id(1), { body: 'x' }, IDS.ana)).rejects.toMatchObject({
        code: 'COMMENT_DELETED',
      });
    });

    it('editar uno ajeno da NOT_COMMENT_AUTHOR', async () => {
      await expect(service.update(id(1), { body: 'x' }, IDS.beto)).rejects.toMatchObject({
        code: 'NOT_COMMENT_AUTHOR',
      });
    });

    it('borrar es lógico', async () => {
      await service.delete(id(1), IDS.ana);

      expect(repository.softDelete).toHaveBeenCalledWith(id(1));
    });
  });
});
