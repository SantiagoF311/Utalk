import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  IDS,
  makeForum,
  makeGeneralPanel,
  makePanel,
  makeProfile,
} from '../../testing/fixtures.js';
import type { PanelsService } from '../panels/panels.service.js';
import type { ProfilesService } from '../profiles/profiles.service.js';
import type { ForumRepository } from './domain/forum.repository.js';
import type { ForumModeratorRepository } from './domain/forumModerator.repository.js';
import { ForumsService } from './forums.service.js';

describe('ForumsService', () => {
  let forums: jest.Mocked<ForumRepository>;
  let moderators: jest.Mocked<ForumModeratorRepository>;
  let profiles: { findById: jest.Mock<ProfilesService['findById']> };
  let panels: { findById: jest.Mock<PanelsService['findById']> };
  let service: ForumsService;

  beforeEach(() => {
    forums = {
      create: jest.fn<ForumRepository['create']>().mockResolvedValue(makeForum()),
      findById: jest.fn<ForumRepository['findById']>().mockResolvedValue(makeForum()),
      findByPanelId: jest.fn<ForumRepository['findByPanelId']>(),
      findByPanelAndSlug: jest.fn<ForumRepository['findByPanelAndSlug']>().mockResolvedValue(null),
      update: jest.fn<ForumRepository['update']>().mockResolvedValue(makeForum()),
      delete: jest.fn<ForumRepository['delete']>().mockResolvedValue(undefined),
    };
    moderators = {
      isModerator: jest.fn<ForumModeratorRepository['isModerator']>().mockResolvedValue(false),
    };
    profiles = {
      findById: jest.fn<ProfilesService['findById']>().mockResolvedValue(makeProfile()),
    };
    panels = { findById: jest.fn<PanelsService['findById']>().mockResolvedValue(makePanel()) };
    service = new ForumsService(
      forums,
      moderators,
      panels as unknown as PanelsService,
      profiles as unknown as ProfilesService,
    );
  });

  describe('create', () => {
    const input = { panelId: IDS.ustPanel, slug: 'calculo', name: 'Cálculo' };

    it('crea en el panel de tu universidad', async () => {
      await service.create(input, IDS.ana);
      expect(forums.create).toHaveBeenCalledWith({ ...input, createdBy: IDS.ana });
    });

    it('no deja crear en el panel de otra universidad', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ universityId: IDS.otherUniversity }));

      await expect(service.create(input, IDS.beto)).rejects.toMatchObject({
        code: 'CANNOT_PUBLISH_IN_PANEL',
      });
      expect(forums.create).not.toHaveBeenCalled();
    });

    it('cualquiera crea en el general', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ universityId: IDS.otherUniversity }));
      panels.findById.mockResolvedValue(makeGeneralPanel());

      await expect(service.create(input, IDS.beto)).resolves.toBeDefined();
    });

    it('slug repetido en el mismo panel da FORUM_SLUG_TAKEN', async () => {
      forums.findByPanelAndSlug.mockResolvedValue(makeForum());

      await expect(service.create(input, IDS.ana)).rejects.toMatchObject({
        code: 'FORUM_SLUG_TAKEN',
      });
    });
  });

  describe('canModerate', () => {
    it('un admin modera cualquier foro sin ser moderador', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ role: 'admin' }));

      await expect(service.canModerate(IDS.forum, IDS.admin)).resolves.toBe(true);
      expect(moderators.isModerator).not.toHaveBeenCalled();
    });

    it('un usuario modera solo si tiene fila en forum_moderators', async () => {
      moderators.isModerator.mockResolvedValue(true);
      await expect(service.canModerate(IDS.forum, IDS.ana)).resolves.toBe(true);

      moderators.isModerator.mockResolvedValue(false);
      await expect(service.canModerate(IDS.forum, IDS.ana)).resolves.toBe(false);
    });

    it('haber creado el foro no da permisos por sí solo (cuenta forum_moderators)', async () => {
      // makeForum() lo creó ana, pero no tiene fila de moderadora.
      await expect(service.update(IDS.forum, { name: 'x' }, IDS.ana)).rejects.toMatchObject({
        code: 'NOT_FORUM_MODERATOR',
      });
      expect(forums.update).not.toHaveBeenCalled();
    });
  });
});
