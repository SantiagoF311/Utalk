import type { ReportCategory } from '@utalk/shared';
import { ReportEntity } from './report.entity.js';

// Espeja el check `reports_exactly_one_target`: el tipo no permite
// construir un reporte con ambos targets o con ninguno.
export type ReportTarget =
  { postId: string; commentId: null } | { postId: null; commentId: string };

export type NewReport = ReportTarget & {
  reportedBy: string;
  category: ReportCategory;
  reason: string | null;
};

// Un reporte con la publicación a la que apunta (la del comentario, si es
// un comentario), para "Mis reportes".
export interface ReportWithPost {
  report: ReportEntity;
  postId: string;
  postTitle: string;
}

export interface ReportRepository {
  // Si esa persona ya reportó ese contenido (dos requests simultáneos que
  // pasaron el chequeo del service), lanza ALREADY_REPORTED.
  create(report: NewReport): Promise<ReportEntity>;
  existsByReporter(target: ReportTarget, reportedBy: string): Promise<boolean>;
  findAll(): Promise<ReportEntity[]>;
  findById(id: string): Promise<ReportEntity | null>;
  // Los reportes de una persona, del más nuevo al más viejo.
  findByReporter(reportedBy: string): Promise<ReportWithPost[]>;
}

export const REPORT_REPOSITORY = Symbol('REPORT_REPOSITORY');
