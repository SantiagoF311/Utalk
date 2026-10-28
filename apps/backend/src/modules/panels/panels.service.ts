import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePanelInput, UpdatePanelInput } from '@utalk/shared';
import { UniversitiesService } from '../universities/universities.service.js';
import { PanelEntity } from './domain/panel.entity.js';
import { PANEL_REPOSITORY } from './domain/panel.repository.js';
import type { PanelRepository } from './domain/panel.repository.js';

@Injectable()
export class PanelsService {
  constructor(
    @Inject(PANEL_REPOSITORY) private readonly panelRepository: PanelRepository,
    private readonly universitiesService: UniversitiesService,
  ) {}

  async create(input: CreatePanelInput): Promise<PanelEntity> {
    if (input.universityId !== null) {
      await this.universitiesService.findById(input.universityId);

      const existingForUniversity = await this.panelRepository.findByUniversityId(input.universityId);
      if (existingForUniversity) {
        throw new ConflictException(`University ${input.universityId} already has a panel`);
      }
    }

    const existingSlug = await this.panelRepository.findBySlug(input.slug);
    if (existingSlug) {
      throw new ConflictException(`Panel slug "${input.slug}" is already taken`);
    }

    return this.panelRepository.create({
      universityId: input.universityId,
      slug: input.slug,
      name: input.name,
    });
  }

  async findAll(): Promise<PanelEntity[]> {
    return this.panelRepository.findAll();
  }

  async findById(id: string): Promise<PanelEntity> {
    const panel = await this.panelRepository.findById(id);
    if (!panel) {
      throw new NotFoundException(`Panel ${id} not found`);
    }
    return panel;
  }

  async update(id: string, input: UpdatePanelInput): Promise<PanelEntity> {
    await this.findById(id);
    return this.panelRepository.update(id, { name: input.name });
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.panelRepository.delete(id);
  }
}
