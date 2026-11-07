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
  Query,
} from '@nestjs/common';
import { createCommunitySchema, updateCommunitySchema } from '@utalk/shared';
import type { Community, List } from '@utalk/shared';
import { CurrentUserId } from '../auth/auth.guard.js';
import { toCommunityView } from './community.view.js';
import { CommunitiesService } from './communities.service.js';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUserId() userId: string): Promise<Community> {
    const input = createCommunitySchema.parse(body);
    return toCommunityView(await this.communitiesService.create(input, userId));
  }

  @Get()
  async findByPanelId(@Query('panelId', ParseUUIDPipe) panelId: string): Promise<List<Community>> {
    const communities = await this.communitiesService.findByPanelId(panelId);
    return { items: communities.map(toCommunityView) };
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Community> {
    return toCommunityView(await this.communitiesService.findById(id));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<Community> {
    const input = updateCommunitySchema.parse(body);
    return toCommunityView(await this.communitiesService.update(id, input, userId));
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUserId() userId: string) {
    await this.communitiesService.delete(id, userId);
  }
}
