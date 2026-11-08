import { Inject, Injectable } from '@nestjs/common';
import type { SearchPage, SearchQuery } from '@utalk/shared';
import { PanelsService } from '../panels/panels.service.js';
import { SEARCH_REPOSITORY } from './domain/search.repository.js';
import type { SearchRepository } from './domain/search.repository.js';
import { toSearchResultView } from './search.view.js';

@Injectable()
export class SearchService {
  constructor(
    @Inject(SEARCH_REPOSITORY) private readonly searchRepository: SearchRepository,
    private readonly panelsService: PanelsService,
  ) {}

  async search(query: SearchQuery): Promise<SearchPage> {
    // 404 explícito si el panel no existe, en vez de "no hay resultados".
    await this.panelsService.findById(query.panelId);

    // El cursor es el offset (ver la función search_content). Se pide uno de
    // más para saber si hay otra página sin contar todos los resultados.
    const offset = query.cursor ? Number(query.cursor) : 0;
    const hits = await this.searchRepository.search({
      query: query.q,
      panelId: query.panelId,
      sort: query.sort,
      limit: query.limit + 1,
      offset,
    });

    const hasMore = hits.length > query.limit;
    return {
      items: hits.slice(0, query.limit).map(toSearchResultView),
      nextCursor: hasMore ? String(offset + query.limit) : null,
    };
  }
}
