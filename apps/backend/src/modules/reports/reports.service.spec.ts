import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppException } from '../../common/appException.js';
import { IDS, makeComment, makePost, makeProfile } from '../../testing/fixtures.js';
import type { CommentsService } from '../comments/comments.service.js';
import type { PostsService } from '../posts/posts.service.js';
import type { ProfilesService } from '../profiles/profiles.service.js';
import { ReportEntity } from './domain/report.entity.js';
import type { NewReport, ReportRepository } from './domain/report.repository.js';
import { ReportsService } from './reports.service.js';

const REPORT_ID = '00000000-0000-4000-8000-000000000201';
const COMMENT_ID = '00000000-0000-4000-8000-0000000000f1';

const savedReport = (report: NewReport) =>
  new ReportEntity(
    REPORT_ID,
    1,
    report.postId,
    report.commentId,
    report.reportedBy,
    'user',
    report.category,
    report.reason,
    'pending',
    null,
    new Date('2026-11-07T12:00:00.000Z'),
  );

describe('ReportsService', () => {
  let repository: jest.Mocked<ReportRepository>;
  let posts: { findById: jest.Mock<PostsService['findById']> };
  let comments: { findById: jest.Mock<CommentsService['findById']> };
  let profiles: { findById: jest.Mock<ProfilesService['findById']> };
  let service: ReportsService;

  beforeEach(() => {
    repository = {
      create: jest
        .fn<ReportRepository['create']>()
        .mockImplementation((report) => Promise.resolve(savedReport(report))),
      existsByReporter: jest.fn<ReportRepository['existsByReporter']>().mockResolvedValue(false),
      findAll: jest.fn<ReportRepository['findAll']>(),
      findById: jest.fn<ReportRepository['findById']>(),
      findByReporter: jest.fn<ReportRepository['findByReporter']>(),
    };
    // El post y el comentario son de Ana; reporta Beto.
    posts = { findById: jest.fn<PostsService['findById']>().mockResolvedValue(makePost()) };
    comments = {
      findById: jest.fn<CommentsService['findById']>().mockResolvedValue(makeComment()),
    };
    profiles = {
      findById: jest
        .fn<ProfilesService['findById']>()
        .mockResolvedValue(makeProfile({ id: IDS.beto })),
    };

    service = new ReportsService(
      repository,
      posts as unknown as PostsService,
      comments as unknown as CommentsService,
      profiles as unknown as ProfilesService,
    );
  });

  describe('create', () => {
    it('reporta un post con su motivo y detalle', async () => {
      const report = await service.create(
        { postId: IDS.post, commentId: null, category: 'exposes_person', reason: 'Dice el salón' },
        IDS.beto,
      );

      expect(repository.create).toHaveBeenCalledWith({
        postId: IDS.post,
        commentId: null,
        reportedBy: IDS.beto,
        category: 'exposes_person',
        reason: 'Dice el salón',
      });
      expect(report.category).toBe('exposes_person');
      expect(report.isPending()).toBe(true);
    });

    it('reporta un comentario sin detalle', async () => {
      await service.create(
        { postId: null, commentId: COMMENT_ID, category: 'harassment', reason: null },
        IDS.beto,
      );

      expect(comments.findById).toHaveBeenCalledWith(COMMENT_ID);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ postId: null, commentId: COMMENT_ID, reason: null }),
      );
    });

    it('no deja reportar un post propio', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ id: IDS.ana }));

      await expect(
        service.create(
          { postId: IDS.post, commentId: null, category: 'spam', reason: null },
          IDS.ana,
        ),
      ).rejects.toMatchObject({ code: 'CANNOT_REPORT_OWN_CONTENT' });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('no deja reportar un comentario propio', async () => {
      await expect(
        service.create(
          { postId: null, commentId: COMMENT_ID, category: 'spam', reason: null },
          IDS.ana,
        ),
      ).rejects.toMatchObject({ code: 'CANNOT_REPORT_OWN_CONTENT' });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('ALREADY_REPORTED si esa persona ya lo reportó', async () => {
      repository.existsByReporter.mockResolvedValue(true);

      await expect(
        service.create(
          { postId: IDS.post, commentId: null, category: 'threat', reason: null },
          IDS.beto,
        ),
      ).rejects.toMatchObject({ code: 'ALREADY_REPORTED' });
      expect(repository.existsByReporter).toHaveBeenCalledWith(
        { postId: IDS.post, commentId: null },
        IDS.beto,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('propaga POST_NOT_FOUND si el post no existe', async () => {
      posts.findById.mockRejectedValue(new AppException('POST_NOT_FOUND', 'not found'));

      await expect(
        service.create(
          { postId: IDS.post, commentId: null, category: 'other', reason: null },
          IDS.beto,
        ),
      ).rejects.toMatchObject({ code: 'POST_NOT_FOUND' });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('propaga POST_REMOVED si la moderación ya eliminó el post', async () => {
      posts.findById.mockRejectedValue(new AppException('POST_REMOVED', 'removed'));

      await expect(
        service.create(
          { postId: IDS.post, commentId: null, category: 'spam', reason: null },
          IDS.beto,
        ),
      ).rejects.toMatchObject({ code: 'POST_REMOVED' });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findMine', () => {
    it('devuelve los reportes de quien pregunta', async () => {
      const mine = [
        {
          report: savedReport({
            postId: IDS.post,
            commentId: null,
            reportedBy: IDS.beto,
            category: 'spam',
            reason: null,
          }),
          postId: IDS.post,
          postTitle: 'Hola',
        },
      ];
      repository.findByReporter.mockResolvedValue(mine);

      await expect(service.findMine(IDS.beto)).resolves.toBe(mine);
      expect(repository.findByReporter).toHaveBeenCalledWith(IDS.beto);
    });
  });
});
