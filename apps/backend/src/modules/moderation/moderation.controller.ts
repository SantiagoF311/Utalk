import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { moderationQueueQuerySchema, resolveReportsSchema } from '@utalk/shared';
import type { List, ModerationCase, ModerationScope, ResolveReportsResult } from '@utalk/shared';
import { CurrentUserId } from '../auth/auth.guard.js';
import { ModerationService } from './moderation.service.js';
import { toModerationCaseView, toModerationScopeView } from './moderation.view.js';

// Moderadores de comunidad y admins. El permiso depende de la comunidad, así
// que se valida en el service (no con @AdminOnly).
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  // Qué modera quien pregunta (la app decide si muestra la entrada).
  @Get('scope')
  async findScope(@CurrentUserId() userId: string): Promise<ModerationScope> {
    return toModerationScopeView(await this.moderationService.findScope(userId));
  }

  // GET /moderation/queue?communityId=…
  @Get('queue')
  async findQueue(
    @Query() rawQuery: unknown,
    @CurrentUserId() userId: string,
  ): Promise<List<ModerationCase>> {
    const query = moderationQueueQuerySchema.parse(rawQuery);
    const cases = await this.moderationService.findQueue(query, userId);
    return {
      items: cases.map((entry) =>
        toModerationCaseView(entry, this.moderationService.imageUrlOf(entry)),
      ),
    };
  }

  @Post('resolve')
  @HttpCode(200)
  async resolve(
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<ResolveReportsResult> {
    const input = resolveReportsSchema.parse(body);
    return { resolvedCount: await this.moderationService.resolve(input, userId) };
  }
}
