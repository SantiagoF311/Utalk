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
import { createForumSchema, updateForumSchema } from '@utalk/shared';
import type { Forum, List } from '@utalk/shared';
import { CurrentUserId } from '../auth/auth.guard.js';
import { toForumView } from './forum.view.js';
import { ForumsService } from './forums.service.js';

@Controller('forums')
export class ForumsController {
  constructor(private readonly forumsService: ForumsService) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUserId() userId: string): Promise<Forum> {
    const input = createForumSchema.parse(body);
    return toForumView(await this.forumsService.create(input, userId));
  }

  @Get()
  async findByPanelId(@Query('panelId', ParseUUIDPipe) panelId: string): Promise<List<Forum>> {
    const forums = await this.forumsService.findByPanelId(panelId);
    return { items: forums.map(toForumView) };
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Forum> {
    return toForumView(await this.forumsService.findById(id));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<Forum> {
    const input = updateForumSchema.parse(body);
    return toForumView(await this.forumsService.update(id, input, userId));
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUserId() userId: string) {
    await this.forumsService.delete(id, userId);
  }
}
