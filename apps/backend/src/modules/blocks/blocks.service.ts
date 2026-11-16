import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/appException.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { BLOCK_REPOSITORY } from './domain/block.repository.js';
import type { BlockRepository, BlockWithUser } from './domain/block.repository.js';

@Injectable()
export class BlocksService {
  constructor(
    @Inject(BLOCK_REPOSITORY) private readonly blockRepository: BlockRepository,
    private readonly profilesService: ProfilesService,
  ) {}

  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new AppException('CANNOT_BLOCK_SELF', 'You cannot block yourself');
    }
    // 404 explícito si esa persona no existe.
    await this.profilesService.findById(blockedId);
    await this.blockRepository.add(blockerId, blockedId);
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.blockRepository.remove(blockerId, blockedId);
  }

  async findMine(blockerId: string): Promise<BlockWithUser[]> {
    return this.blockRepository.findByBlocker(blockerId);
  }

  // Para el chat: si hay un bloqueo entre los dos, en cualquier sentido.
  async isBlockedBetween(userId: string, otherUserId: string): Promise<boolean> {
    const block = await this.blockRepository.findBetween(userId, otherUserId);
    return block?.isBetween(userId, otherUserId) ?? false;
  }
}
