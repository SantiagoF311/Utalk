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
});
