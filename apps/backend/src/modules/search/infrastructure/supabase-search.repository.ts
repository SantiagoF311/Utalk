import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import type { SearchParams, SearchRepository } from '../domain/search.repository.js';
import { SearchHitEntity } from '../domain/searchHit.entity.js';
import type { SearchHitKind } from '../domain/searchHit.entity.js';

// Fila de la función SQL `search_content` (migración full_text_search).
interface SearchRow {
  kind: SearchHitKind;
  id: string;
  post_id: string;
  post_title: string;
  community_id: string;
  body: string;
  score: number;
  comment_count: number | null;
  created_at: string;
  author_id: string;
  author_username: string;
  university_id: string;
  university_slug: string;
  university_name: string;
}

function toEntity(row: SearchRow): SearchHitEntity {
  return new SearchHitEntity(
    row.kind,
    row.id,
    row.post_id,
    row.post_title,
    row.community_id,
    row.body,
    row.score,
    row.comment_count,
    {
      id: row.author_id,
      username: row.author_username,
      university: { id: row.university_id, slug: row.university_slug, name: row.university_name },
    },
    new Date(row.created_at),
  );
}

@Injectable()
export class SupabaseSearchRepository implements SearchRepository {
  constructor(private readonly supabase: SupabaseService) {}

  // La búsqueda es una función SQL (y no un select armado acá) porque mezcla
  // dos tablas en un solo orden por relevancia, algo que el cliente de
  // Supabase no puede expresar.
  async search(params: SearchParams): Promise<SearchHitEntity[]> {
    const { data, error } = await this.supabase.client.rpc('search_content', {
      p_query: params.query,
      p_panel_id: params.panelId,
      p_sort: params.sort,
      p_limit: params.limit,
      p_offset: params.offset,
    });

    if (error) throw new Error(error.message);
    return (data as SearchRow[]).map(toEntity);
  }
}
