import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import type { BlockedUser, List } from '@utalk/shared';
import { CurrentUserId } from '../auth/auth.guard.js';
import { toBlockedUserView } from './block.view.js';
import { BlocksService } from './blocks.service.js';

// Bloquear es "poner" (PUT) y desbloquear es DELETE: los dos idempotentes.
@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get()
  async findMine(@CurrentUserId() userId: string): Promise<List<BlockedUser>> {
    const blocks = await this.blocksService.findMine(userId);
    return { items: blocks.map(toBlockedUserView) };
  }

  @Put(':userId')
  @HttpCode(204)
  async block(
    @Param('userId', ParseUUIDPipe) blockedId: string,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    await this.blocksService.block(userId, blockedId);
  }

  @Delete(':userId')
  @HttpCode(204)
  async unblock(
    @Param('userId', ParseUUIDPipe) blockedId: string,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    await this.blocksService.unblock(userId, blockedId);
  }
}
