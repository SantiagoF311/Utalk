import { describe, expect, it } from '@jest/globals';
import type { ReportCategory } from '@utalk/shared';
import { IDS } from '../../../testing/fixtures.js';
import { ModerationCaseEntity } from './moderationCase.entity.js';

function makeCase(categories: ReportCategory[], firstReportedAt = '2026-11-10T12:00:00.000Z') {
  return new ModerationCaseEntity(
    { postId: IDS.post, commentId: null },
    IDS.post,
    IDS.community,
    'calculo',
    'Hola',
    'Cuerpo',
    { id: IDS.ana, username: 'ana' },
    false,
    categories.length,
    categories,
    [],
    new Date(firstReportedAt),
    new Date(firstReportedAt),
    false,
    null,
  );
}

describe('ModerationCaseEntity', () => {
  describe('priority', () => {
    it('amenazas y lo que expone a alguien son urgentes', () => {
      expect(makeCase(['threat']).priority()).toBe(0);
      expect(makeCase(['exposes_person']).priority()).toBe(0);
    });

    it('el acoso va después', () => {
      expect(makeCase(['harassment']).priority()).toBe(1);
    });

    it('spam y otros, al final', () => {
      expect(makeCase(['spam', 'other']).priority()).toBe(2);
    });

    it('manda el motivo más grave de sus reportes', () => {
      expect(makeCase(['spam', 'threat']).priority()).toBe(0);
    });
  });

  describe('compareTo', () => {
    it('lo más grave va antes, aunque sea más nuevo', () => {
      const urgent = makeCase(['threat'], '2026-11-12T12:00:00.000Z');
      const spam = makeCase(['spam'], '2026-11-01T12:00:00.000Z');
      expect(urgent.compareTo(spam)).toBeLessThan(0);
      expect(spam.compareTo(urgent)).toBeGreaterThan(0);
    });

    it('a igual gravedad, va antes lo que lleva más tiempo esperando', () => {
      const older = makeCase(['spam'], '2026-11-01T12:00:00.000Z');
      const newer = makeCase(['spam'], '2026-11-05T12:00:00.000Z');
      expect(older.compareTo(newer)).toBeLessThan(0);
    });
  });
});
