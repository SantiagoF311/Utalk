import type { ModerationAction } from '@utalk/shared';
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
}

export const MODERATION_REPOSITORY = Symbol('MODERATION_REPOSITORY');
