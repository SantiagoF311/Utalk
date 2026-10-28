import { Controller, Get, Param } from '@nestjs/common';
import { UniversitiesService } from './universities.service.js';

@Controller('universities')
export class UniversitiesController {
  constructor(private readonly universitiesService: UniversitiesService) {}

  @Get()
  async findAll() {
    return this.universitiesService.findAll();
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.universitiesService.findBySlug(slug);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.universitiesService.findById(id);
  }
}
