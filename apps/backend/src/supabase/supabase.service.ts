import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;
  private readonly url: string;
  private readonly publishableKey: string;

  constructor(configService: ConfigService) {
    this.url = configService.getOrThrow<string>('SUPABASE_URL');
    this.publishableKey = configService.getOrThrow<string>('SUPABASE_PUBLISHABLE_KEY');
    const secretKey = configService.getOrThrow<string>('SUPABASE_SECRET_KEY');

    this.client = createClient(this.url, secretKey, {
      auth: { persistSession: false },
    });
  }

  // Cliente nuevo por llamada, con la publishable key, para operaciones que
  // guardan una sesión de usuario en el cliente (ej. signInWithPassword). El
  // cliente compartido (secret key) nunca debe quedar con la sesión de nadie.
  createPublicClient(): SupabaseClient {
    return createClient(this.url, this.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
}
