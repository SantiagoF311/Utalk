import { Injectable } from '@nestjs/common';
import type { ReportCategory, ReportSource, ReportStatus } from '@utalk/shared';
import { AppException } from '../../../common/appException.js';
import { isUniqueViolation } from '../../../common/databaseError.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { ReportEntity } from '../domain/report.entity.js';
import type {
  NewReport,
  ReportRepository,
  ReportTarget,
  ReportWithPost,
} from '../domain/report.repository.js';

interface ReportRow {
  id: string;
  case_number: number;
  post_id: string | null;
  comment_id: string | null;
  reported_by: string | null;
  source: ReportSource;
  category: ReportCategory;
  reason: string | null;
  status: ReportStatus;
  resolved_at: string | null;
  created_at: string;
}

interface PostRef {
  id: string;
  title: string;
}

interface ReportWithPostRow extends ReportRow {
  post: PostRef | null;
  comment: { post: PostRef } | null;
}

// "Mis reportes" muestra los últimos; más atrás no le sirven a nadie.
const MY_REPORTS_LIMIT = 100;

function toEntity(row: ReportRow): ReportEntity {
  return new ReportEntity(
    row.id,
    row.case_number,
    row.post_id,
    row.comment_id,
    row.reported_by,
    row.source,
    row.category,
    row.reason,
    row.status,
    row.resolved_at ? new Date(row.resolved_at) : null,
    new Date(row.created_at),
  );
}

@Injectable()
export class SupabaseReportRepository implements ReportRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async create(report: NewReport): Promise<ReportEntity> {
    // Se mandan ambas columnas explícitamente (una de ellas en null) para
    // que el check `reports_exactly_one_target` siempre se evalúe completo.
    const { data, error } = await this.supabase.client
      .from('reports')
      .insert({
        post_id: report.postId,
        comment_id: report.commentId,
        reported_by: report.reportedBy,
        category: report.category,
        reason: report.reason,
      })
      .select()
      .single();

    // Dos reportes simultáneos pueden pasar el chequeo del service; los
    // índices únicos parciales frenan al segundo.
    if (
      error &&
      (isUniqueViolation(error, 'reports_one_per_post_and_reporter') ||
        isUniqueViolation(error, 'reports_one_per_comment_and_reporter'))
    ) {
      throw new AppException('ALREADY_REPORTED', 'You already reported this content');
    }
    if (error) throw new Error(error.message);
    return toEntity(data);
  }

  async existsByReporter(target: ReportTarget, reportedBy: string): Promise<boolean> {
    const query = this.supabase.client
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reported_by', reportedBy);
    const { count, error } = await (target.postId !== null
      ? query.eq('post_id', target.postId)
      : query.eq('comment_id', target.commentId));

    if (error) throw new Error(error.message);
    return (count ?? 0) > 0;
  }

  async findAll(): Promise<ReportEntity[]> {
    const { data, error } = await this.supabase.client
      .from('reports')
      .select()
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data as ReportRow[]).map(toEntity);
  }

  async findById(id: string): Promise<ReportEntity | null> {
    const { data, error } = await this.supabase.client
      .from('reports')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data) : null;
  }

  async findByReporter(reportedBy: string): Promise<ReportWithPost[]> {
    const { data, error } = await this.supabase.client
      .from('reports')
      .select('*, post:posts(id, title), comment:comments(post:posts(id, title))')
      .eq('reported_by', reportedBy)
      .order('created_at', { ascending: false })
      .limit(MY_REPORTS_LIMIT);

    if (error) throw new Error(error.message);
    return (data as unknown as ReportWithPostRow[]).flatMap((row) => {
      // El check de la tabla garantiza uno de los dos; el post del comentario
      // existe por su FK.
      const post = row.post ?? row.comment?.post;
      return post ? [{ report: toEntity(row), postId: post.id, postTitle: post.title }] : [];
    });
  }
}
