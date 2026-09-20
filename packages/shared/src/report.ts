import { z } from 'zod';

export const reportSchema = z
  .object({
    id: z.uuid(),
    postId: z.uuid().nullable(),
    commentId: z.uuid().nullable(),
    reportedBy: z.uuid(),
    reason: z.string().min(1).max(500),
    createdAt: z.iso.datetime(),
  })
  .refine((report) => (report.postId === null) !== (report.commentId === null), {
    message: 'Exactly one of postId or commentId must be set',
  });

export type Report = z.infer<typeof reportSchema>;

export const createReportSchema = z
  .object({
    postId: z.uuid().nullable(),
    commentId: z.uuid().nullable(),
    reason: z.string().min(1).max(500),
  })
  .refine((report) => (report.postId === null) !== (report.commentId === null), {
    message: 'Exactly one of postId or commentId must be set',
  });

export type CreateReportInput = z.infer<typeof createReportSchema>;
