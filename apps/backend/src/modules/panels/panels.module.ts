import { Module } from '@nestjs/common';
import { UniversitiesModule } from '../universities/universities.module.js';
import { PANEL_REPOSITORY } from './domain/panel.repository.js';
import { SupabasePanelRepository } from './infrastructure/supabase-panel.repository.js';
import { PanelsController } from './panels.controller.js';
import { PanelsService } from './panels.service.js';

@Module({
  imports: [UniversitiesModule],
  controllers: [PanelsController],
  providers: [PanelsService, { provide: PANEL_REPOSITORY, useClass: SupabasePanelRepository }],
  exports: [PanelsService],
})
export class PanelsModule {}
