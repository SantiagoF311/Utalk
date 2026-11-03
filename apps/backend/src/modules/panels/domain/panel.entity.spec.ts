import { describe, expect, it } from '@jest/globals';
import { IDS, makeGeneralPanel, makePanel } from '../../../testing/fixtures.js';

describe('PanelEntity', () => {
  describe('acceptsPostsFrom (regla de publicación)', () => {
    it('acepta a estudiantes de su propia universidad', () => {
      expect(makePanel().acceptsPostsFrom(IDS.ust)).toBe(true);
    });

    it('rechaza a estudiantes de otra universidad', () => {
      expect(makePanel().acceptsPostsFrom(IDS.otherUniversity)).toBe(false);
    });

    it('el panel general acepta a cualquier universidad', () => {
      expect(makeGeneralPanel().acceptsPostsFrom(IDS.otherUniversity)).toBe(true);
    });

    it('un panel especial sin universidad también acepta a cualquiera', () => {
      const events = makePanel({ universityId: null, slug: 'eventos' });
      expect(events.acceptsPostsFrom(IDS.otherUniversity)).toBe(true);
    });
  });

  describe('isGeneral', () => {
    it('identifica al general por slug, no por no tener universidad', () => {
      expect(makeGeneralPanel().isGeneral()).toBe(true);
      expect(makePanel({ universityId: null, slug: 'eventos' }).isGeneral()).toBe(false);
    });
  });
});
