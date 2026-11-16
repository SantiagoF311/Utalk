import { describe, expect, it } from '@jest/globals';
import { IDS, makeComment } from '../../../testing/fixtures.js';

describe('CommentEntity', () => {
  it('es raíz si no tiene padre', () => {
    expect(makeComment().isRoot()).toBe(true);
    expect(makeComment({ parentId: '00000000-0000-4000-8000-0000000000f9' }).isRoot()).toBe(false);
  });

  it('sabe a qué post pertenece', () => {
    expect(makeComment().belongsToPost(IDS.post)).toBe(true);
    expect(makeComment().belongsToPost('00000000-0000-4000-8000-000000000000')).toBe(false);
  });

  it('sabe quién es su autor, aunque esté borrado', () => {
    expect(makeComment().isAuthoredBy(IDS.ana)).toBe(true);
    expect(makeComment().isAuthoredBy(IDS.beto)).toBe(false);
    expect(makeComment({ deletedAt: new Date() }).isAuthoredBy(IDS.ana)).toBe(true);
  });

  it('sabe si lo eliminó un moderador (y no su autor)', () => {
    const removed = makeComment({ deletedAt: new Date(), removedAt: new Date() });
    expect(removed.isRemoved()).toBe(true);
    expect(removed.isDeleted()).toBe(true);
    expect(makeComment({ deletedAt: new Date() }).isRemoved()).toBe(false);
  });

  describe('isEditableBy', () => {
    it('lo puede editar su autor', () => {
      expect(makeComment().isEditableBy(IDS.ana)).toBe(true);
    });

    it('no lo puede editar otro usuario', () => {
      expect(makeComment().isEditableBy(IDS.beto)).toBe(false);
    });

    it('borrado, no lo puede editar ni su autor', () => {
      const deleted = makeComment({ deletedAt: new Date() });
      expect(deleted.isDeleted()).toBe(true);
      expect(deleted.isEditableBy(IDS.ana)).toBe(false);
    });
  });
});
