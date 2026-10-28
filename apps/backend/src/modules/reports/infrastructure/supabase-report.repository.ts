import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { ReportEntity } from '../domain/report.entity.js';
import type { NewReport, ReportRepository } from '../domain/report.repository.js';

interface ReportRow {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  reported_by: string;
  reason: string;
  created_at: string;
}

function toEntity(row: ReportRow): ReportEntity {
  return new ReportEntity(
    row.id,
    row.post_id,
    row.comment_id,
    row.reported_by,
    row.reason,
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
        reason: report.reason,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEntity(data);
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

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('reports').delete().eq('id', id);

    if (error) throw new Error(error.message);
  }
}
