import type { ModerationAction, ReportCategory } from '@utalk/shared';
import type { ReportTarget } from '../../reports/domain/report.repository.js';
import { ModerationCaseEntity } from './moderationCase.entity.js';

export interface ModerationRepository {
  // Contenido con reportes pendientes en esas comunidades (null = todas),
  // sin un orden en particular: lo ordena el service.
  findPendingCases(communityIds: string[] | null): Promise<ModerationCaseEntity[]>;
  // Cierra todos los reportes pendientes de ese contenido con la acción
  // (y, si es `remove`, lo elimina), en una sola transacción. Devuelve
  // cuántos reportes cerró: 0 si no quedaba ninguno pendiente.
  resolve(target: ReportTarget, action: ModerationAction, resolvedBy: string): Promise<number>;
  // Reporte automático de la moderación por IA (sin persona detrás): además
  // retiene el post y le avisa al autor. Idempotente: un reporte pendiente de
  // la IA por post a la vez.
  reportPostByAi(postId: string, category: ReportCategory, reason: string): Promise<AiReportResult>;
}

export interface AiReportResult {
  // false = ya había uno pendiente (un reintento).
  reported: boolean;
  // El aviso al autor, para mandarlo por push (null si no se creó).
  notificationId: string | null;
}

export const MODERATION_REPOSITORY = Symbol('MODERATION_REPOSITORY');
