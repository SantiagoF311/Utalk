import type { Profile, ProfileStats, PublicProfile } from '@utalk/shared';
import type { UniversityEntity } from '../universities/domain/university.entity.js';
import type { ProfileEntity } from './domain/profile.entity.js';

// Perfil propio (/auth/me, completar registro): incluye el rol, que la app
// usa para mostrar opciones de admin, y lo de la cuenta (privacidad, último
// cambio de apodo).
export function toProfileView(profile: ProfileEntity): Profile {
  return {
    id: profile.id,
    username: profile.username,
    universityId: profile.universityId,
    role: profile.role,
    isPrivate: profile.isPrivate,
    usernameChangedAt: profile.usernameChangedAt?.toISOString() ?? null,
    createdAt: profile.createdAt.toISOString(),
  };
}

// Perfil de un usuario (el propio o el de otro): con su universidad (siempre
// se muestra), sin el rol. `stats` es null si quien mira no puede ver su
// historial (perfil privado ajeno).
export function toPublicProfileView(
  profile: ProfileEntity,
  university: UniversityEntity,
  stats: ProfileStats | null,
): PublicProfile {
  return {
    id: profile.id,
    username: profile.username,
    university: { id: university.id, slug: university.slug, name: university.name },
    isPrivate: profile.isPrivate,
    stats,
    createdAt: profile.createdAt.toISOString(),
  };
}
