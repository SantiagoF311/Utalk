import { describe, expect, it } from '@jest/globals';
import { IDS, makeProfile } from '../../../testing/fixtures.js';

describe('ProfileEntity', () => {
  it('isAdmin depende solo del rol', () => {
    expect(makeProfile().isAdmin()).toBe(false);
    expect(makeProfile({ role: 'admin' }).isAdmin()).toBe(true);
  });

  it('sabe a qué universidad pertenece', () => {
    expect(makeProfile().belongsToUniversity(IDS.ust)).toBe(true);
    expect(makeProfile().belongsToUniversity(IDS.otherUniversity)).toBe(false);
  });

  describe('cambio de apodo', () => {
    const changed = new Date('2026-11-01T12:00:00.000Z');

    it('si nunca lo cambió, puede cambiarlo ya', () => {
      expect(makeProfile().canChangeUsername(changed)).toBe(true);
      expect(makeProfile().nextUsernameChangeAt()).toBeNull();
    });

    it('después de cambiarlo, tiene que esperar 30 días', () => {
      const profile = makeProfile({ usernameChangedAt: changed });

      expect(profile.nextUsernameChangeAt()).toEqual(new Date('2026-12-01T12:00:00.000Z'));
      expect(profile.canChangeUsername(new Date('2026-11-30T12:00:00.000Z'))).toBe(false);
      expect(profile.canChangeUsername(new Date('2026-12-01T12:00:00.000Z'))).toBe(true);
    });
  });

  describe('historial', () => {
    it('un perfil público lo ve cualquiera', () => {
      expect(makeProfile().historyVisibleTo(IDS.beto)).toBe(true);
    });

    it('uno privado solo lo ve su dueño', () => {
      const profile = makeProfile({ isPrivate: true });

      expect(profile.historyVisibleTo(IDS.beto)).toBe(false);
      expect(profile.historyVisibleTo(IDS.ana)).toBe(true);
    });
  });
});
