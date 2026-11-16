import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createReportSchema } from '@utalk/shared';
import type { List, MyReport, Report } from '@utalk/shared';
import { STRICT_RATE_LIMITS } from '../../common/rateLimits.js';
import { AdminOnly } from '../auth/admin.guard.js';
import { CurrentUserId } from '../auth/auth.guard.js';
import { toMyReportView, toReportView } from './report.view.js';
import { ReportsService } from './reports.service.js';

// Los reportes no se editan ni se borran: cambian de estado cuando la
// moderación resuelve el contenido (POST /moderation/resolve). Cualquiera
// reporta y ve los suyos; la lista cruda de todos es solo para admins.
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Throttle(STRICT_RATE_LIMITS.createReport)
  @Post()
  async create(@Body() body: unknown, @CurrentUserId() userId: string): Promise<Report> {
    const input = createReportSchema.parse(body);
    return toReportView(await this.reportsService.create(input, userId));
  }

  // Antes que `:id`, para que "mine" no se tome como un id.
  @Get('mine')
  async findMine(@CurrentUserId() userId: string): Promise<List<MyReport>> {
    const reports = await this.reportsService.findMine(userId);
    return { items: reports.map(toMyReportView) };
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
}
