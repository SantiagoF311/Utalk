import { z } from 'zod';

// Motivo del reporte. Lista fija (no texto libre) para que la moderación
// pueda filtrar y priorizar: una amenaza o un doxxing no esperan en la misma
// fila que el spam.
export const REPORT_CATEGORIES = [
  'exposes_person', // nombres, fotos, horarios, salón, número…
  'threat', // amenaza o incita a la violencia
  'harassment', // acoso contra alguien
  'spam', // spam o cuenta falsa
  'other',
] as const;

export const reportCategorySchema = z.enum(REPORT_CATEGORIES);

export type ReportCategory = z.infer<typeof reportCategorySchema>;

export const REPORT_DETAIL_MAX_LENGTH = 500;

// pending: nadie lo revisó todavía; removed: un moderador eliminó el
// contenido; dismissed: lo revisó y lo dejó (sin acción).
export const REPORT_STATUSES = ['pending', 'removed', 'dismissed'] as const;

export const reportStatusSchema = z.enum(REPORT_STATUSES);

export type ReportStatus = z.infer<typeof reportStatusSchema>;

// user: lo reportó una persona; ai: la moderación por IA, al publicarse.
export const REPORT_SOURCES = ['user', 'ai'] as const;

export const reportSourceSchema = z.enum(REPORT_SOURCES);

export type ReportSource = z.infer<typeof reportSourceSchema>;

export const reportSchema = z
  .object({
    id: z.uuid(),
    // Número legible para quien reportó ("caso #42").
    caseNumber: z.number().int().positive(),
    postId: z.uuid().nullable(),
    commentId: z.uuid().nullable(),
    // null = lo reportó la IA (source 'ai').
    reportedBy: z.uuid().nullable(),
    source: reportSourceSchema,
    category: reportCategorySchema,
    // Detalle opcional que escribe quien reporta.
    reason: z.string().max(REPORT_DETAIL_MAX_LENGTH).nullable(),
    status: reportStatusSchema,
    resolvedAt: z.iso.datetime().nullable(),
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
    category: reportCategorySchema,
    // Vacío o solo espacios = sin detalle.
    reason: z
      .string()
      .trim()
      .max(REPORT_DETAIL_MAX_LENGTH)
      .nullish()
      .transform((reason) => (reason ? reason : null)),
  })
  .refine((report) => (report.postId === null) !== (report.commentId === null), {
    message: 'Exactly one of postId or commentId must be set',
  });

export type CreateReportInput = z.infer<typeof createReportSchema>;

// Un reporte en "Mis reportes" (GET /reports/mine): su número de caso, en
// qué quedó y sobre qué publicación era (para un comentario, la publicación
// donde está). Quién lo resolvió no se muestra.
export const myReportSchema = z.object({
  id: z.uuid(),
  caseNumber: z.number().int().positive(),
  target: z.enum(['post', 'comment']),
  postId: z.uuid(),
  postTitle: z.string(),
  category: reportCategorySchema,
  status: reportStatusSchema,
  resolvedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type MyReport = z.infer<typeof myReportSchema>;
