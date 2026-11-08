import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { createCommunitySchema, updateCommunitySchema } from '@utalk/shared';
import type { CommunityView, List } from '@utalk/shared';
import { CurrentUserId } from '../auth/auth.guard.js';
import { CommunitiesService } from './communities.service.js';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUserId() userId: string): Promise<CommunityView> {
    const input = createCommunitySchema.parse(body);
    return this.communitiesService.create(input, userId);
  }

  @Get()
  async findByPanelId(
    @Query('panelId', ParseUUIDPipe) panelId: string,
    @CurrentUserId() userId: string,
  ): Promise<List<CommunityView>> {
    return { items: await this.communitiesService.findViewsByPanelId(panelId, userId) };
  }

  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ): Promise<CommunityView> {
    return this.communitiesService.findViewById(id, userId);
  }

  // Unirse (PUT: idempotente, unirse dos veces no es un error).
  @Put(':id/membership')
  async join(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ): Promise<CommunityView> {
    return this.communitiesService.join(id, userId);
  }

  // Salirse. Devuelve la comunidad actualizada (con el contador nuevo).
  @Delete(':id/membership')
  async leave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ): Promise<CommunityView> {
    return this.communitiesService.leave(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<CommunityView> {
    const input = updateCommunitySchema.parse(body);
    return this.communitiesService.update(id, input, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUserId() userId: string) {
    await this.communitiesService.delete(id, userId);
  }
}
