import { Injectable } from '@nestjs/common';
import type { PostImageType } from '@utalk/shared';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import type { PostImageStorage } from '../domain/postImage.storage.js';

// Creado por la migración `post_images`.
const BUCKET = 'post-images';

@Injectable()
export class SupabasePostImageStorage implements PostImageStorage {
  constructor(private readonly supabase: SupabaseService) {}

  async upload(path: string, content: Uint8Array, type: PostImageType): Promise<void> {
    const { error } = await this.supabase.client.storage.from(BUCKET).upload(path, content, {
      contentType: type,
      // Las rutas son únicas (uuid): el archivo no cambia nunca.
      cacheControl: '31536000',
      upsert: false,
    });

    if (error) throw new Error(error.message);
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.supabase.client.storage.from(BUCKET).remove([path]);

    if (error) throw new Error(error.message);
  }

  publicUrl(path: string): string {
    return this.supabase.client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
}
