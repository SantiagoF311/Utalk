import { Controller, Get, Query } from '@nestjs/common';
import { searchQuerySchema } from '@utalk/shared';
import type { SearchPage } from '@utalk/shared';
import { SearchService } from './search.service.js';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // GET /search?q=…&panelId=…&sort=relevance|new&cursor=…&limit=…
  @Get()
  async search(@Query() rawQuery: unknown): Promise<SearchPage> {
    const query = searchQuerySchema.parse(rawQuery);
    return this.searchService.search(query);
  }
}
