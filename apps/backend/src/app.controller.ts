import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { SupabaseService } from './supabase/supabase.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly supabaseService: SupabaseService,
  ) {}

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
