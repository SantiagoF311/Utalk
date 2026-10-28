import { UniversityEntity } from './university.entity.js';

export interface UniversityRepository {
  findByEmailDomain(domain: string): Promise<UniversityEntity | null>;
}

export const UNIVERSITY_REPOSITORY = Symbol('UNIVERSITY_REPOSITORY');
