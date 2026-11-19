import { describe, expect, it } from '@jest/globals';
import { detectImageType, imageExtension } from './postImage.js';

const bytes = (...values: number[]) => new Uint8Array([...values, 0, 0, 0, 0]);
const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

describe('detectImageType', () => {
  it('reconoce JPEG, PNG y WebP por sus primeros bytes', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      'image/png',
    );
    expect(detectImageType(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP')))).toBe(
      'image/webp',
    );
  });

  it('rechaza lo que no es una imagen aceptada, se llame como se llame', () => {
    expect(detectImageType(new TextEncoder().encode('<svg onload="alert(1)">'))).toBeNull();
    expect(detectImageType(bytes(...ascii('GIF89a')))).toBeNull();
    // RIFF que no es WebP (ej. un WAV).
    expect(detectImageType(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVE')))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe('imageExtension', () => {
  it('da la extensión de cada tipo', () => {
    expect(imageExtension('image/jpeg')).toBe('jpg');
    expect(imageExtension('image/png')).toBe('png');
    expect(imageExtension('image/webp')).toBe('webp');
  });
});
