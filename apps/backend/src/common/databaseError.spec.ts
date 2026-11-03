import { describe, expect, it } from '@jest/globals';
import type { PostgrestError } from '@supabase/supabase-js';
import { isUniqueViolation } from './databaseError.js';

function pgError(code: string, constraint: string): PostgrestError {
  return {
    code,
    message: `duplicate key value violates unique constraint "${constraint}"`,
    details: '',
    hint: '',
    name: 'PostgrestError',
  } as PostgrestError;
}

describe('isUniqueViolation', () => {
  it('reconoce la constraint pedida', () => {
    expect(
      isUniqueViolation(pgError('23505', 'profiles_username_key'), 'profiles_username_key'),
    ).toBe(true);
  });

  it('distingue entre constraints de la misma tabla', () => {
    // Completar el registro dos veces choca con la PK, no con el username.
    expect(isUniqueViolation(pgError('23505', 'profiles_pkey'), 'profiles_username_key')).toBe(
      false,
    );
  });

  it('no confunde constraints de nombre parecido', () => {
    expect(isUniqueViolation(pgError('23505', 'panels_slug_key_v2'), 'panels_slug_key')).toBe(
      false,
    );
  });

  it('ignora otros códigos de Postgres', () => {
    expect(
      isUniqueViolation(pgError('23503', 'profiles_username_key'), 'profiles_username_key'),
    ).toBe(false);
  });
});
