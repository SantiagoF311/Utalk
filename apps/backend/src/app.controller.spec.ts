import { describe, expect, it } from '@jest/globals';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import type { SupabaseService } from './supabase/supabase.service.js';

describe('AppController', () => {
  it('responde el health check sin tocar Supabase', () => {
    const controller = new AppController(new AppService(), {} as SupabaseService);

    expect(controller.getHello()).toBe('Hello World!');
  });
});
