import { Inject, Injectable } from '@nestjs/common';
import type { SearchPage, SearchQuery } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { CommunitiesService } from '../communities/communities.service.js';
import { PanelsService } from '../panels/panels.service.js';
import { SEARCH_REPOSITORY } from './domain/search.repository.js';
import type { SearchRepository } from './domain/search.repository.js';
import { toSearchResultView } from './search.view.js';

@Injectable()
export class SearchService {
  constructor(
    @Inject(SEARCH_REPOSITORY) private readonly searchRepository: SearchRepository,
    private readonly panelsService: PanelsService,
    private readonly communitiesService: CommunitiesService,
  ) {}

  async search(query: SearchQuery): Promise<SearchPage> {
    const scope = await this.resolveScope(query);

    // El cursor es el offset (ver la función search_content). Se pide uno de
    // más para saber si hay otra página sin contar todos los resultados.
    const offset = query.cursor ? Number(query.cursor) : 0;
    const hits = await this.searchRepository.search({
      query: query.q,
      ...scope,
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

  // 404 explícito si el panel o la comunidad no existen, en vez de "no hay
  // resultados". Una comunidad se busca dentro de su panel.
  private async resolveScope(
    query: SearchQuery,
  ): Promise<{ panelId: string; communityId: string | null }> {
    if (query.communityId) {
      const community = await this.communitiesService.findById(query.communityId);
      return { panelId: community.panelId, communityId: community.id };
    }
    // El schema ya exige exactamente uno de los dos; esto es por si se llama
    // al service sin pasar por él.
    if (!query.panelId) {
      throw new AppException(
        'VALIDATION_FAILED',
        'Exactly one of panelId or communityId must be set',
      );
    }
    const panel = await this.panelsService.findById(query.panelId);
    return { panelId: panel.id, communityId: null };
  }
}
