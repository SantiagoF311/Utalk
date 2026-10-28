import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { createPanelSchema, updatePanelSchema } from '@utalk/shared';
import { PanelsService } from './panels.service.js';

@Controller('panels')
export class PanelsController {
  constructor(private readonly panelsService: PanelsService) {}

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

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const input = updatePanelSchema.parse(body);
    return this.panelsService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string) {
    await this.panelsService.delete(id);
  }
}
