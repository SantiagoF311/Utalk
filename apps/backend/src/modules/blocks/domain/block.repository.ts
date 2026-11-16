import type { Author } from '@utalk/shared';
import { BlockEntity } from './block.entity.js';

export interface BlockWithUser {
  block: BlockEntity;
  // A quién se bloqueó.
  user: Author;
}

export interface BlockRepository {
  // Idempotentes: bloquear dos veces o desbloquear sin bloqueo no son errores
  // (el botón se puede tocar varias veces).
  add(blockerId: string, blockedId: string): Promise<void>;
  remove(blockerId: string, blockedId: string): Promise<void>;
  // El bloqueo entre esos dos, en cualquier sentido, o null.
  findBetween(userId: string, otherUserId: string): Promise<BlockEntity | null>;
  // A quiénes bloqueó, del más reciente al más viejo.
  findByBlocker(blockerId: string): Promise<BlockWithUser[]>;
}

export const BLOCK_REPOSITORY = Symbol('BLOCK_REPOSITORY');
