import type { PostImageType } from '@utalk/shared';

// La imagen tal como llega en el request.
export interface PostImageUpload {
  content: Uint8Array;
}

const EXTENSIONS: Record<PostImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function startsWith(content: Uint8Array, bytes: number[], offset = 0): boolean {
  return bytes.every((byte, i) => content[offset + i] === byte);
}

// El tipo real según los primeros bytes del archivo ("magic numbers"), no
// según el nombre ni el Content-Type que manda el cliente, que pueden
// mentir. null = no es una imagen aceptada.
export function detectImageType(content: Uint8Array): PostImageType | null {
  if (startsWith(content, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  // "RIFF" <tamaño, 4 bytes> "WEBP"
  if (
    startsWith(content, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(content, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  return null;
}

export function imageExtension(type: PostImageType): string {
  return EXTENSIONS[type];
}
