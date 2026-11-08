import { Module } from '@nestjs/common';
import { CommunitiesModule } from '../communities/communities.module.js';
import { PanelsModule } from '../panels/panels.module.js';
import { SEARCH_REPOSITORY } from './domain/search.repository.js';
import { SupabaseSearchRepository } from './infrastructure/supabase-search.repository.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [PanelsModule, CommunitiesModule],
  controllers: [SearchController],
  providers: [SearchService, { provide: SEARCH_REPOSITORY, useClass: SupabaseSearchRepository }],
})
export class SearchModule {}
