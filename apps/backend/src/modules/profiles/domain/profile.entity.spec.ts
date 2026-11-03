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
});
