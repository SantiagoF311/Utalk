import { Injectable } from '@nestjs/common';
import type { ModerationAction, ReportCategory } from '@utalk/shared';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import type { ReportTarget } from '../../reports/domain/report.repository.js';
import type { ModerationRepository } from '../domain/moderation.repository.js';
import { ModerationCaseEntity } from '../domain/moderationCase.entity.js';

// Fila de la función SQL moderation_queue (ver la migración `moderation`).
// post_id es siempre la publicación; comment_id, el comentario reportado si
// lo es.
interface CaseRow {
  post_id: string;
  comment_id: string | null;
  community_id: string;
  community_slug: string;
  post_title: string;
  body: string;
  author_id: string;
  author_username: string;
  is_deleted: boolean;
  report_count: number;
  categories: ReportCategory[];
  reasons: string[];
  first_reported_at: string;
  last_reported_at: string;
}

function toTarget(row: CaseRow): ReportTarget {
  return row.comment_id !== null
    ? { postId: null, commentId: row.comment_id }
    : { postId: row.post_id, commentId: null };
}

function toEntity(row: CaseRow): ModerationCaseEntity {
  return new ModerationCaseEntity(
    toTarget(row),
    row.post_id,
    row.community_id,
    row.community_slug,
    row.post_title,
    row.body,
    { id: row.author_id, username: row.author_username },
    row.is_deleted,
    row.report_count,
    row.categories,
    row.reasons,
    new Date(row.first_reported_at),
    new Date(row.last_reported_at),
  );
}

@Injectable()
export class SupabaseModerationRepository implements ModerationRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findPendingCases(communityIds: string[] | null): Promise<ModerationCaseEntity[]> {
    const { data, error } = await this.supabase.client.rpc('moderation_queue', {
      p_community_ids: communityIds,
    });

    if (error) throw new Error(error.message);
    return (data as CaseRow[]).map(toEntity);
  }

  async resolve(
    target: ReportTarget,
    action: ModerationAction,
    resolvedBy: string,
  ): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('resolve_reports', {
      p_post_id: target.postId,
      p_comment_id: target.commentId,
      p_action: action,
      p_resolved_by: resolvedBy,
    });

    if (error) throw new Error(error.message);
    return data as number;
  }
}
