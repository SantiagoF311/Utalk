import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { createReportSchema } from '@utalk/shared';
import { AdminOnly } from '../auth/admin.guard.js';
import { CurrentUserId } from '../auth/auth.guard.js';
import { ReportsService } from './reports.service.js';

// Los reportes son inmutables: no hay PATCH. DELETE = descartar/resolver.
// Cualquiera reporta; solo admins los ven y resuelven (los mods de foro
// tendrán su propia vista filtrada por foro).
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUserId() userId: string) {
    const input = createReportSchema.parse(body);
    return this.reportsService.create(input, userId);
  }

  @AdminOnly()
  @Get()
  async findAll() {
    return this.reportsService.findAll();
  }

  @AdminOnly()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.reportsService.findById(id);
  }

  @AdminOnly()
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string) {
    await this.reportsService.delete(id);
  }
}
