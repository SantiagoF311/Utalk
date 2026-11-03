import type { Profile, PublicProfile } from '@utalk/shared';
import type { UniversityEntity } from '../universities/domain/university.entity.js';
import type { ProfileEntity } from './domain/profile.entity.js';

// Perfil propio (/auth/me, completar registro): incluye el rol, que la app
// usa para mostrar opciones de admin.
export function toProfileView(profile: ProfileEntity): Profile {
  return {
    id: profile.id,
    username: profile.username,
    universityId: profile.universityId,
    role: profile.role,
    createdAt: profile.createdAt.toISOString(),
  };
}

// Perfil de otro usuario: con su universidad (siempre se muestra), sin el rol.
export function toPublicProfileView(
  profile: ProfileEntity,
  university: UniversityEntity,
): PublicProfile {
  return {
    id: profile.id,
    username: profile.username,
    university: { id: university.id, slug: university.slug, name: university.name },
    createdAt: profile.createdAt.toISOString(),
  };
}
