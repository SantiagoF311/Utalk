import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { IDS, makeProfile, makeUniversity } from '../../testing/fixtures.js';
import type { UniversitiesService } from '../universities/universities.service.js';
import type { ProfileRepository } from './domain/profile.repository.js';
import type { UsernameReservationRepository } from './domain/usernameReservation.repository.js';
import { ProfilesService } from './profiles.service.js';

const NOW = new Date('2026-11-11T12:00:00.000Z');
const STATS = { karma: 42, postCount: 3, commentCount: 7 };

describe('ProfilesService', () => {
  let profiles: jest.Mocked<ProfileRepository>;
  let reservations: jest.Mocked<UsernameReservationRepository>;
  let service: ProfilesService;

  beforeEach(() => {
    profiles = {
      create: jest.fn<ProfileRepository['create']>().mockResolvedValue(makeProfile()),
      findById: jest.fn<ProfileRepository['findById']>().mockResolvedValue(makeProfile()),
      findByUsername: jest.fn<ProfileRepository['findByUsername']>().mockResolvedValue(null),
      update: jest.fn<ProfileRepository['update']>().mockResolvedValue(makeProfile()),
      findStats: jest.fn<ProfileRepository['findStats']>().mockResolvedValue(STATS),
    };
    reservations = {
      findActive: jest.fn<UsernameReservationRepository['findActive']>().mockResolvedValue(null),
      reserve: jest.fn<UsernameReservationRepository['reserve']>().mockResolvedValue(undefined),
    };
    const universities = {
      findById: jest.fn<UniversitiesService['findById']>().mockResolvedValue(makeUniversity()),
    };
    service = new ProfilesService(
      profiles,
      reservations,
      universities as unknown as UniversitiesService,
    );
  });

  describe('findPublicById', () => {
    it('un perfil público muestra sus contadores a cualquiera', async () => {
      const view = await service.findPublicById(IDS.ana, IDS.beto);

      expect(view.stats).toEqual(STATS);
      expect(view.isPrivate).toBe(false);
    });

    it('uno privado no muestra sus contadores a otros', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ isPrivate: true }));

      const view = await service.findPublicById(IDS.ana, IDS.beto);

      expect(view.stats).toBeNull();
      expect(profiles.findStats).not.toHaveBeenCalled();
    });

    it('su dueño sí los ve aunque sea privado', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ isPrivate: true }));

      const view = await service.findPublicById(IDS.ana, IDS.ana);

      expect(view.stats).toEqual(STATS);
    });
  });

  describe('assertHistoryVisible', () => {
    it('PROFILE_PRIVATE si es privado y no es el propio', async () => {
      profiles.findById.mockResolvedValue(makeProfile({ isPrivate: true }));

      await expect(service.assertHistoryVisible(IDS.ana, IDS.beto)).rejects.toMatchObject({
        code: 'PROFILE_PRIVATE',
      });
      await expect(service.assertHistoryVisible(IDS.ana, IDS.ana)).resolves.toBeUndefined();
    });
  });

  describe('isUsernameAvailable', () => {
    it('libre si nadie lo usa ni está reservado', async () => {
      await expect(service.isUsernameAvailable('nuevo', NOW)).resolves.toBe(true);
    });

    it('un apodo reservado (alguien lo dejó hace poco) cuenta como tomado', async () => {
      reservations.findActive.mockResolvedValue({ username: 'ana', userId: IDS.ana, until: NOW });

      await expect(service.isUsernameAvailable('ana', NOW)).resolves.toBe(false);
    });
  });

  describe('updateMe', () => {
    it('cambia el apodo, guarda cuándo y reserva el viejo 30 días', async () => {
      await service.updateMe(IDS.ana, { username: 'ana_nueva' }, NOW);

      expect(profiles.update).toHaveBeenCalledWith(IDS.ana, {
        username: 'ana_nueva',
        usernameChangedAt: NOW,
        isPrivate: undefined,
      });
      expect(reservations.reserve).toHaveBeenCalledWith({
        username: 'ana',
        userId: IDS.ana,
        until: new Date('2026-12-11T12:00:00.000Z'),
      });
    });

    it('USERNAME_CHANGE_TOO_SOON si lo cambió hace menos de 30 días', async () => {
      profiles.findById.mockResolvedValue(
        makeProfile({ usernameChangedAt: new Date('2026-11-01T12:00:00.000Z') }),
      );

      await expect(service.updateMe(IDS.ana, { username: 'otro' }, NOW)).rejects.toMatchObject({
        code: 'USERNAME_CHANGE_TOO_SOON',
      });
      expect(profiles.update).not.toHaveBeenCalled();
    });

    it('USERNAME_TAKEN si otro ya lo usa', async () => {
      profiles.findByUsername.mockResolvedValue(makeProfile({ id: IDS.beto, username: 'beto' }));

      await expect(service.updateMe(IDS.ana, { username: 'beto' }, NOW)).rejects.toMatchObject({
        code: 'USERNAME_TAKEN',
      });
      expect(profiles.update).not.toHaveBeenCalled();
    });

    it('cambiar solo la privacidad no cuenta como cambio de apodo', async () => {
      profiles.findById.mockResolvedValue(
        makeProfile({ usernameChangedAt: new Date('2026-11-10T12:00:00.000Z') }),
      );

      await service.updateMe(IDS.ana, { isPrivate: true, username: 'ana' }, NOW);

      expect(profiles.update).toHaveBeenCalledWith(IDS.ana, {
        username: undefined,
        usernameChangedAt: undefined,
        isPrivate: true,
      });
      expect(reservations.reserve).not.toHaveBeenCalled();
    });
  });
});
