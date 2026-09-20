import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SupabaseModule, ProfilesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
