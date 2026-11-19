import { describe, expect, it } from '@jest/globals';
import { isFinalAttempt } from './notifications.processor.js';

describe('isFinalAttempt', () => {
  it('con reintentos pendientes no es el último', () => {
    expect(isFinalAttempt({ attemptsMade: 1, opts: { attempts: 3 } })).toBe(false);
    expect(isFinalAttempt({ attemptsMade: 2, opts: { attempts: 3 } })).toBe(false);
  });

  it('cuando ya no quedan reintentos, sí', () => {
    expect(isFinalAttempt({ attemptsMade: 3, opts: { attempts: 3 } })).toBe(true);
  });

  it('sin `attempts` configurado, BullMQ intenta una sola vez', () => {
    expect(isFinalAttempt({ attemptsMade: 1, opts: {} })).toBe(true);
  });
});
