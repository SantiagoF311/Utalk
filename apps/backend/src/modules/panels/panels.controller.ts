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
} from '@nestjs/common';
import { createPanelSchema, updatePanelSchema } from '@utalk/shared';
import type { List, Panel } from '@utalk/shared';
import { AdminOnly } from '../auth/admin.guard.js';
import { toPanelView } from './panel.view.js';
import { PanelsService } from './panels.service.js';

// Los paneles son fijos (uno por universidad + general): solo admins los
// administran. Leerlos es libre para cualquier usuario con sesión.
@Controller('panels')
export class PanelsController {
  constructor(private readonly panelsService: PanelsService) {}

  @AdminOnly()
  @Post()
  async create(@Body() body: unknown): Promise<Panel> {
    const input = createPanelSchema.parse(body);
    return toPanelView(await this.panelsService.create(input));
  }

  @Get()
  async findAll(): Promise<List<Panel>> {
    const panels = await this.panelsService.findAll();
    return { items: panels.map(toPanelView) };
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Panel> {
    return toPanelView(await this.panelsService.findById(id));
  }

  @AdminOnly()
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<Panel> {
    const input = updatePanelSchema.parse(body);
    return toPanelView(await this.panelsService.update(id, input));
  }

  @AdminOnly()
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.panelsService.delete(id);
  }
}
