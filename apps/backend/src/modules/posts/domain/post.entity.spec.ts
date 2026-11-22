import { describe, expect, it } from '@jest/globals';
import { IDS, makePost } from '../../../testing/fixtures.js';

describe('PostEntity', () => {
  it('sabe quién es su autor', () => {
    expect(makePost().isAuthoredBy(IDS.ana)).toBe(true);
    expect(makePost().isAuthoredBy(IDS.beto)).toBe(false);
  });

  it('solo lo puede editar su autor', () => {
    expect(makePost().isEditableBy(IDS.ana)).toBe(true);
    expect(makePost().isEditableBy(IDS.beto)).toBe(false);
  });

  it('eliminado por moderación, no lo puede editar ni su autor', () => {
    const removed = makePost({ removedAt: new Date() });
    expect(removed.isRemoved()).toBe(true);
    expect(removed.isEditableBy(IDS.ana)).toBe(false);
    expect(makePost().isRemoved()).toBe(false);
  });

  it('retenido por la IA: lo ve su autor y nadie más', () => {
    const held = makePost({ heldAt: new Date() });

    expect(held.isHeld()).toBe(true);
    expect(held.isVisibleTo(IDS.ana)).toBe(true);
    expect(held.isVisibleTo(IDS.beto)).toBe(false);
  });

  it('uno normal lo ve cualquiera; uno eliminado, nadie (ni su autor)', () => {
    expect(makePost().isVisibleTo(IDS.beto)).toBe(true);
    expect(makePost({ removedAt: new Date() }).isVisibleTo(IDS.ana)).toBe(false);
  });
});
