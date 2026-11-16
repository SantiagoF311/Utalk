import type { ReportCategory } from '@utalk/shared';
import type { ReportTarget } from '../../reports/domain/report.repository.js';

// Prioridad por motivo: una amenaza o algo que expone a una persona (nombre,
// salón, horario) no puede esperar detrás del spam.
const URGENT_CATEGORIES: readonly ReportCategory[] = ['threat', 'exposes_person'];
const HIGH_CATEGORIES: readonly ReportCategory[] = ['harassment'];

export interface CaseAuthor {
  id: string;
  username: string;
}

// Un caso de la cola: un post o un comentario con todos sus reportes
// pendientes. Se modera el contenido, no cada reporte por separado.
export class ModerationCaseEntity {
  constructor(
    // Lo reportado: el post o el comentario.
    readonly target: ReportTarget,
    // El post reportado o, para un comentario, el post donde está.
    readonly postId: string,
    readonly communityId: string,
    readonly communitySlug: string,
    readonly postTitle: string,
    readonly body: string,
    readonly author: CaseAuthor,
    // Su autor lo borró después de que lo reportaran.
    readonly isDeleted: boolean,
    readonly reportCount: number,
    readonly categories: ReportCategory[],
    readonly reasons: string[],
    readonly firstReportedAt: Date,
    readonly lastReportedAt: Date,
  ) {}

  // 0 = urgente, 1 = alta, 2 = normal. Manda el motivo más grave de todos
  // sus reportes.
  priority(): number {
    if (this.categories.some((category) => URGENT_CATEGORIES.includes(category))) return 0;
    if (this.categories.some((category) => HIGH_CATEGORIES.includes(category))) return 1;
    return 2;
  }

  // Orden de la cola (negativo = este va antes): primero lo más grave y, a
  // igual gravedad, lo que lleva más tiempo esperando.
  compareTo(other: ModerationCaseEntity): number {
    return (
      this.priority() - other.priority() ||
      this.firstReportedAt.getTime() - other.firstReportedAt.getTime()
    );
  }
}
