import type { SearchSort } from '@utalk/shared';
import { SearchHitEntity } from './searchHit.entity.js';

export interface SearchParams {
  query: string;
  panelId: string;
  // null = todo el panel.
  communityId: string | null;
  sort: SearchSort;
  limit: number;
  offset: number;
}

export interface SearchRepository {
  // Publicaciones y comentarios (no borrados) del panel que coinciden con la
  // búsqueda, ya ordenados. Nunca busca en apodos.
  search(params: SearchParams): Promise<SearchHitEntity[]>;
}

export const SEARCH_REPOSITORY = Symbol('SEARCH_REPOSITORY');
