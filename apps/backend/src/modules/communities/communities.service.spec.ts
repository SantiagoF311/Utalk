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
import type { CommunityMemberRepository } from './domain/communityMember.repository.js';
import type { CommunityModeratorRepository } from './domain/communityModerator.repository.js';
import { CommunitiesService } from './communities.service.js';

describe('CommunitiesService', () => {
  let communities: jest.Mocked<CommunityRepository>;
  let moderators: jest.Mocked<CommunityModeratorRepository>;
  let members: jest.Mocked<CommunityMemberRepository>;
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
    members = {
      add: jest.fn<CommunityMemberRepository['add']>().mockResolvedValue(undefined),
      remove: jest.fn<CommunityMemberRepository['remove']>().mockResolvedValue(undefined),
      findJoinedByUser: jest
        .fn<CommunityMemberRepository['findJoinedByUser']>()
        .mockResolvedValue(new Set()),
    };
    profiles = {
      findById: jest.fn<ProfilesService['findById']>().mockResolvedValue(makeProfile()),
    };
    panels = { findById: jest.fn<PanelsService['findById']>().mockResolvedValue(makePanel()) };
    service = new CommunitiesService(
      communities,
      moderators,
      members,
      panels as unknown as PanelsService,
      profiles as unknown as ProfilesService,
    );
  });

  describe('create', () => {
    const input = {
      panelId: IDS.ustPanel,
      slug: 'calculo',
      name: 'Cálculo',
      description: 'Parciales, talleres y dudas de cálculo',
      topic: 'academic' as const,
    };

    it('crea en el panel de tu universidad, con descripción y tema', async () => {
      await service.create(input, IDS.ana);
      expect(communities.create).toHaveBeenCalledWith({ ...input, createdBy: IDS.ana });
    });

    it('quien la crea queda unido, con el contador ya contándolo', async () => {
      // El insert devuelve la fila de antes del trigger (0 miembros); el
      // service la relee para devolver el contador real.
      communities.create.mockResolvedValue(makeCommunity({ memberCount: 0 }));
      communities.findById.mockResolvedValue(makeCommunity({ memberCount: 1 }));

      const view = await service.create(input, IDS.ana);

      expect(view.joinedByMe).toBe(true);
      expect(view.memberCount).toBe(1);
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

  describe('miembros', () => {
    it('marca las comunidades del panel a las que quien mira se unió', async () => {
      const other = makeCommunity({ id: '00000000-0000-4000-8000-0000000000d2' });
      communities.findByPanelId.mockResolvedValue([makeCommunity(), other]);
      members.findJoinedByUser.mockResolvedValue(new Set([other.id]));

      const views = await service.findViewsByPanelId(IDS.ustPanel, IDS.beto);

      expect(views.map((view) => view.joinedByMe)).toEqual([false, true]);
      expect(members.findJoinedByUser).toHaveBeenCalledWith([IDS.community, other.id], IDS.beto);
    });

    it('unirse agrega al miembro y devuelve la comunidad ya unida', async () => {
      members.findJoinedByUser.mockResolvedValue(new Set([IDS.community]));

      const view = await service.join(IDS.community, IDS.beto);

      expect(members.add).toHaveBeenCalledWith(IDS.community, IDS.beto);
      expect(view.joinedByMe).toBe(true);
    });

    it('se puede unir a una comunidad de otra universidad (leer es libre)', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ universityId: IDS.otherUniversity }));

      await service.join(IDS.community, IDS.beto);

      expect(members.add).toHaveBeenCalled();
    });

    it('salirse quita al miembro', async () => {
      const view = await service.leave(IDS.community, IDS.beto);

      expect(members.remove).toHaveBeenCalledWith(IDS.community, IDS.beto);
      expect(view.joinedByMe).toBe(false);
    });

    it('COMMUNITY_NOT_FOUND al unirse a una que no existe', async () => {
      communities.findById.mockResolvedValue(null);

      await expect(service.join(IDS.community, IDS.beto)).rejects.toMatchObject({
        code: 'COMMUNITY_NOT_FOUND',
      });
      expect(members.add).not.toHaveBeenCalled();
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
