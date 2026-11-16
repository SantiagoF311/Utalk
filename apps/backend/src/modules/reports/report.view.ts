import type { MyReport, Report } from '@utalk/shared';
import type { ReportEntity } from './domain/report.entity.js';
import type { ReportWithPost } from './domain/report.repository.js';

export function toReportView(report: ReportEntity): Report {
  return {
    id: report.id,
    caseNumber: report.caseNumber,
    postId: report.postId,
    commentId: report.commentId,
    reportedBy: report.reportedBy,
    category: report.category,
    reason: report.reason,
    status: report.status,
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
  };
}

// Para quien reportó: en qué quedó, sin quién lo resolvió.
export function toMyReportView({ report, postId, postTitle }: ReportWithPost): MyReport {
  return {
    id: report.id,
    caseNumber: report.caseNumber,
    target: report.targetsPost() ? 'post' : 'comment',
    postId,
    postTitle,
    category: report.category,
    status: report.status,
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
  };
}
