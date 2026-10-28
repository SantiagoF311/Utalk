import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './modules/auth/auth.guard.js';
import { SupabaseService } from './supabase/supabase.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly supabaseService: SupabaseService,
  ) {}

  // Público para que el health check del hosting pueda verificar que el
  // proceso está vivo sin token.
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health/supabase')
  async checkSupabase() {
    const { error } = await this.supabaseService.client.auth.getSession();
    return { connected: !error, error: error?.message ?? null };
  }
}
