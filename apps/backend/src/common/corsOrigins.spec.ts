import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CORS_ORIGINS, parseCorsOrigins } from './corsOrigins.js';

describe('parseCorsOrigins', () => {
  it('sin la variable, solo el servidor de desarrollo de Expo web', () => {
    expect(parseCorsOrigins(undefined)).toEqual(DEFAULT_CORS_ORIGINS);
    expect(parseCorsOrigins('  ')).toEqual(DEFAULT_CORS_ORIGINS);
  });

  it('separa por coma, recorta espacios y la barra final', () => {
    expect(parseCorsOrigins('https://utalk.app/, http://localhost:8081 ,')).toEqual([
      'https://utalk.app',
      'http://localhost:8081',
    ]);
  });
});
