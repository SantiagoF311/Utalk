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
import { CurrentUserId } from '../auth/auth.guard.js';
import { ForumsService } from './forums.service.js';

@Controller('forums')
export class ForumsController {
  constructor(private readonly forumsService: ForumsService) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUserId() userId: string) {
    const input = createForumSchema.parse(body);
    return this.forumsService.create(input, userId);
  }

  @Get()
  async findByPanelId(@Query('panelId', ParseUUIDPipe) panelId: string) {
    return this.forumsService.findByPanelId(panelId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.forumsService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentUserId() userId: string) {
    const input = updateForumSchema.parse(body);
    return this.forumsService.update(id, input, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string, @CurrentUserId() userId: string) {
    await this.forumsService.delete(id, userId);
  }
}
