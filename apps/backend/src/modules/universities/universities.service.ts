import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UniversityEntity } from './domain/university.entity.js';
import { UNIVERSITY_REPOSITORY } from './domain/university.repository.js';
import type { UniversityRepository } from './domain/university.repository.js';

@Injectable()
export class UniversitiesService {
  constructor(
    @Inject(UNIVERSITY_REPOSITORY) private readonly universityRepository: UniversityRepository,
  ) {}

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
