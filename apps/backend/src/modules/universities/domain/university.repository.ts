import { UniversityEntity } from './university.entity.js';

export interface UniversityRepository {
  findAll(): Promise<UniversityEntity[]>;
  findById(id: string): Promise<UniversityEntity | null>;
  findBySlug(slug: string): Promise<UniversityEntity | null>;
  findByEmailDomain(domain: string): Promise<UniversityEntity | null>;
}

export const UNIVERSITY_REPOSITORY = Symbol('UNIVERSITY_REPOSITORY');
