import { REPORT_DETAIL_MAX_LENGTH } from '@utalk/shared';
import type { ReportCategory } from '@utalk/shared';

// Categorías de la API de moderación de OpenAI, en palabras para el
// moderador. Las que no estén acá se muestran tal cual.
const LABELS: Record<string, string> = {
  harassment: 'acoso',
  'harassment/threatening': 'acoso con amenazas',
  hate: 'odio',
  'hate/threatening': 'odio con amenazas',
  illicit: 'actividad ilegal',
  'illicit/violent': 'actividad ilegal violenta',
  'self-harm': 'autolesión',
  'self-harm/intent': 'intención de autolesión',
  'self-harm/instructions': 'instrucciones de autolesión',
  sexual: 'contenido sexual',
  'sexual/minors': 'contenido sexual con menores',
  violence: 'violencia',
  'violence/graphic': 'violencia explícita',
};

// Las que en nuestra cola cuentan como amenaza (urgentes).
const THREAT = new Set([
  'harassment/threatening',
  'hate/threatening',
  'violence',
  'violence/graphic',
  'illicit/violent',
]);
const HARASSMENT = new Set(['harassment', 'hate']);

// El reporte automático: el motivo más grave entre los que marcó la IA (así
// la cola lo prioriza como a uno de una persona) y el detalle para el
// moderador.
export function aiReportFor(categories: string[]): { category: ReportCategory; reason: string } {
  const category: ReportCategory = categories.some((c) => THREAT.has(c))
    ? 'threat'
    : categories.some((c) => HARASSMENT.has(c))
      ? 'harassment'
      : 'other';
  const labels = categories.map((c) => LABELS[c] ?? c).join(', ');
  const reason = `Detectado por IA: ${labels}`.slice(0, REPORT_DETAIL_MAX_LENGTH);
  return { category, reason };
}
