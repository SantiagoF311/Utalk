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

export const reportSchema = z
  .object({
    id: z.uuid(),
    postId: z.uuid().nullable(),
    commentId: z.uuid().nullable(),
    reportedBy: z.uuid(),
    category: reportCategorySchema,
    // Detalle opcional que escribe quien reporta.
    reason: z.string().max(REPORT_DETAIL_MAX_LENGTH).nullable(),
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
