import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UniversityEntity } from './domain/university.entity.js';
import { UNIVERSITY_REPOSITORY } from './domain/university.repository.js';
import type { UniversityRepository } from './domain/university.repository.js';

@Injectable()
export class UniversitiesService {
  constructor(
    @Inject(UNIVERSITY_REPOSITORY) private readonly universityRepository: UniversityRepository,
  ) {}

  async findAll(): Promise<UniversityEntity[]> {
    return this.universityRepository.findAll();
  }

  async findById(id: string): Promise<UniversityEntity> {
    const university = await this.universityRepository.findById(id);
    if (!university) {
      throw new NotFoundException(`University ${id} not found`);
    }
    return university;
  }

  async findBySlug(slug: string): Promise<UniversityEntity> {
    const university = await this.universityRepository.findBySlug(slug);
    if (!university) {
      throw new NotFoundException(`University "${slug}" not found`);
    }
    return university;
  }

  async findByEmail(email: string): Promise<UniversityEntity> {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      throw new NotFoundException('Invalid email');
    }

    const university = await this.universityRepository.findByEmailDomain(domain);
    if (!university) {
      throw new NotFoundException(`No university registered for domain "${domain}"`);
    }

    return university;
  }
}
