import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createReportSchema } from '@utalk/shared';
import type { List, Report } from '@utalk/shared';
import { STRICT_RATE_LIMITS } from '../../common/rateLimits.js';
import { AdminOnly } from '../auth/admin.guard.js';
import { CurrentUserId } from '../auth/auth.guard.js';
import { toReportView } from './report.view.js';
import { ReportsService } from './reports.service.js';

// Los reportes son inmutables: no hay PATCH. DELETE = descartar/resolver.
// Cualquiera reporta; solo admins los ven y resuelven (los mods de comunidad
// tendrán su propia vista filtrada por comunidad).
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Throttle(STRICT_RATE_LIMITS.createReport)
  @Post()
  async create(@Body() body: unknown, @CurrentUserId() userId: string): Promise<Report> {
    const input = createReportSchema.parse(body);
    return toReportView(await this.reportsService.create(input, userId));
  }

  @AdminOnly()
  @Get()
  async findAll(): Promise<List<Report>> {
    const reports = await this.reportsService.findAll();
    return { items: reports.map(toReportView) };
  }

  @AdminOnly()
  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Report> {
    return toReportView(await this.reportsService.findById(id));
  }

  @AdminOnly()
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.reportsService.delete(id);
  }
}
