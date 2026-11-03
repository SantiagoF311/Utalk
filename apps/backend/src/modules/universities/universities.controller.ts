import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { List, University } from '@utalk/shared';
import { UniversitiesService } from './universities.service.js';
import { toUniversityView } from './university.view.js';

@Controller('universities')
export class UniversitiesController {
  constructor(private readonly universitiesService: UniversitiesService) {}

  @Get()
  async findAll(): Promise<List<University>> {
    const universities = await this.universitiesService.findAll();
    return { items: universities.map(toUniversityView) };
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string): Promise<University> {
    return toUniversityView(await this.universitiesService.findBySlug(slug));
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<University> {
    return toUniversityView(await this.universitiesService.findById(id));
  }
}
