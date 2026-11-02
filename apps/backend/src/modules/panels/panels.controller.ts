import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { createPanelSchema, updatePanelSchema } from '@utalk/shared';
import { AdminOnly } from '../auth/admin.guard.js';
import { PanelsService } from './panels.service.js';

// Los paneles son fijos (uno por universidad + general): solo admins los
// administran. Leerlos es libre para cualquier usuario con sesión.
@Controller('panels')
export class PanelsController {
  constructor(private readonly panelsService: PanelsService) {}

  @AdminOnly()
  @Post()
  async create(@Body() body: unknown) {
    const input = createPanelSchema.parse(body);
    return this.panelsService.create(input);
  }

  @Get()
  async findAll() {
    return this.panelsService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.panelsService.findById(id);
  }

  @AdminOnly()
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const input = updatePanelSchema.parse(body);
    return this.panelsService.update(id, input);
  }

  @AdminOnly()
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string) {
    await this.panelsService.delete(id);
  }
}
