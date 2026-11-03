import type { University } from '@utalk/shared';
import type { UniversityEntity } from './domain/university.entity.js';

// Las entidades nunca salen por la red (docs/arquitectura-backend.md): cada
// controller responde con la vista, que define explícitamente qué se expone.
export function toUniversityView(university: UniversityEntity): University {
  return {
    id: university.id,
    slug: university.slug,
    name: university.name,
    emailDomain: university.emailDomain,
    createdAt: university.createdAt.toISOString(),
  };
}
