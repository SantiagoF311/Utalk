import type { Report } from '@utalk/shared';
import type { ReportEntity } from './domain/report.entity.js';

export function toReportView(report: ReportEntity): Report {
  return {
    id: report.id,
    postId: report.postId,
    commentId: report.commentId,
    reportedBy: report.reportedBy,
    reason: report.reason,
    createdAt: report.createdAt.toISOString(),
  };
}
