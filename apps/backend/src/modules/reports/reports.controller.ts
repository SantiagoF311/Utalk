import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { createReportSchema } from '@utalk/shared';
import { CurrentUserId } from '../auth/auth.guard.js';
import { ReportsService } from './reports.service.js';

// Los reportes son inmutables: no hay PATCH. DELETE = descartar/resolver.
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUserId() userId: string) {
    const input = createReportSchema.parse(body);
    return this.reportsService.create(input, userId);
  }

  @Get()
  async findAll() {
    return this.reportsService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.reportsService.findById(id);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string) {
    await this.reportsService.delete(id);
  }
}
