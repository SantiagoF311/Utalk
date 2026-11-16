import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { BlocksController } from './blocks.controller.js';
import { BlocksService } from './blocks.service.js';
import { BLOCK_REPOSITORY } from './domain/block.repository.js';
import { SupabaseBlockRepository } from './infrastructure/supabase-block.repository.js';

@Module({
  imports: [ProfilesModule],
  controllers: [BlocksController],
  providers: [BlocksService, { provide: BLOCK_REPOSITORY, useClass: SupabaseBlockRepository }],
  exports: [BlocksService],
})
export class BlocksModule {}
