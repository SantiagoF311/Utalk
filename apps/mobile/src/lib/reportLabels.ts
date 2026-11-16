import type { ReportCategory, ReportStatus } from '@utalk/shared';

// Textos de los motivos de reporte: los usan el formulario de reportar, la
// cola de moderación y "Mis reportes". En el orden del formulario.
export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  exposes_person: 'Expone a una persona',
  threat: 'Amenaza o incita a la violencia',
  harassment: 'Acoso contra alguien',
  spam: 'Spam o cuenta falsa',
  other: 'Otra cosa',
};

// En qué quedó un reporte, como lo ve quien reportó.
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'En revisión',
  removed: 'Se eliminó',
  dismissed: 'Sin acción',
};
