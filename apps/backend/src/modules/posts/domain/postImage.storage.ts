import type { PostImageType } from '@utalk/shared';

// Puerto del almacenamiento de imágenes: el service sube y borra sin saber
// que abajo está Supabase Storage.
export interface PostImageStorage {
  upload(path: string, content: Uint8Array, type: PostImageType): Promise<void>;
  delete(path: string): Promise<void>;
  // URL pública para mostrarla (no hace ningún pedido: solo la arma).
  publicUrl(path: string): string;
}

export const POST_IMAGE_STORAGE = Symbol('POST_IMAGE_STORAGE');
