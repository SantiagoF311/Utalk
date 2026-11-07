import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  IDS,
  makeCommunity,
  makeGeneralPanel,
  makePanel,
  makeProfile,
} from '../../testing/fixtures.js';
import type { PanelsService } from '../panels/panels.service.js';
import type { ProfilesService } from '../profiles/profiles.service.js';
import type { CommunityRepository } from './domain/community.repository.js';
import type { CommunityModeratorRepository } from './domain/communityModerator.repository.js';
import { CommunitiesService } from './communities.service.js';

describe('CommunitiesService', () => {
  let communities: jest.Mocked<CommunityRepository>;
  let moderators: jest.Mocked<CommunityModeratorRepository>;
  let profiles: { findById: jest.Mock<ProfilesService['findById']> };
  let panels: { findById: jest.Mock<PanelsService['findById']> };
  let service: CommunitiesService;

  beforeEach(() => {
    communities = {
      create: jest.fn<CommunityRepository['create']>().mockResolvedValue(makeCommunity()),
      findById: jest.fn<CommunityRepository['findById']>().mockResolvedValue(makeCommunity()),
      findByPanelId: jest.fn<CommunityRepository['findByPanelId']>(),
      findByPanelAndSlug: jest
        .fn<CommunityRepository['findByPanelAndSlug']>()
        .mockResolvedValue(null),
      update: jest.fn<CommunityRepository['update']>().mockResolvedValue(makeCommunity()),
      delete: jest.fn<CommunityRepository['delete']>().mockResolvedValue(undefined),
    };
    moderators = {
      isModerator: jest.fn<CommunityModeratorRepository['isModerator']>().mockResolvedValue(false),
    };
    profiles = {
      findById: jest.fn<ProfilesService['findById']>().mockResolvedValue(makeProfile()),
    };
    panels = { findById: jest.fn<PanelsService['findById']>().mockResolvedValue(makePanel()) };
    service = new CommunitiesService(
      communities,
      moderators,
      panels as unknown as PanelsService,
      profiles as unknown as ProfilesService,
    );
  });

  describe('create', () => {
    const input = { panelId: IDS.ustPanel, slug: 'calculo', name: 'Cálculo' };

    it('crea en el panel de tu universidad', async () => {
      await service.create(input, IDS.ana);
      expect(communities.create).toHaveBeenCalledWith({ ...input, createdBy: IDS.ana });
    });

    it('no deja crear en el panel de otra universidad', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ universityId: IDS.otherUniversity }));

      await expect(service.create(input, IDS.beto)).rejects.toMatchObject({
        code: 'CANNOT_PUBLISH_IN_PANEL',
      });
      expect(communities.create).not.toHaveBeenCalled();
    });

    it('cualquiera crea en el general', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ universityId: IDS.otherUniversity }));
      panels.findById.mockResolvedValue(makeGeneralPanel());

      await expect(service.create(input, IDS.beto)).resolves.toBeDefined();
    });

    it('slug repetido en el mismo panel da COMMUNITY_SLUG_TAKEN', async () => {
      communities.findByPanelAndSlug.mockResolvedValue(makeCommunity());

      await expect(service.create(input, IDS.ana)).rejects.toMatchObject({
        code: 'COMMUNITY_SLUG_TAKEN',
      });
    });
  });

  describe('canModerate', () => {
    it('un admin modera cualquier comunidad sin ser moderador', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ role: 'admin' }));

      await expect(service.canModerate(IDS.community, IDS.admin)).resolves.toBe(true);
      expect(moderators.isModerator).not.toHaveBeenCalled();
    });

    it('un usuario modera solo si tiene fila en community_moderators', async () => {
      moderators.isModerator.mockResolvedValue(true);
      await expect(service.canModerate(IDS.community, IDS.ana)).resolves.toBe(true);

      moderators.isModerator.mockResolvedValue(false);
      await expect(service.canModerate(IDS.community, IDS.ana)).resolves.toBe(false);
    });

    it('haber creado la comunidad no da permisos por sí solo (cuenta community_moderators)', async () => {
      // makeCommunity() lo creó ana, pero no tiene fila de moderadora.
      await expect(service.update(IDS.community, { name: 'x' }, IDS.ana)).rejects.toMatchObject({
        code: 'NOT_COMMUNITY_MODERATOR',
      });
      expect(communities.update).not.toHaveBeenCalled();
    });
  });
});
