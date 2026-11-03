import type { Author } from '@utalk/shared';
import { CommentEntity } from '../modules/comments/domain/comment.entity.js';
import { ForumEntity } from '../modules/forums/domain/forum.entity.js';
import { PanelEntity } from '../modules/panels/domain/panel.entity.js';
import { PostEntity } from '../modules/posts/domain/post.entity.js';
import { ProfileEntity } from '../modules/profiles/domain/profile.entity.js';
import type { ProfileRole } from '../modules/profiles/domain/profile.entity.js';
import { UniversityEntity } from '../modules/universities/domain/university.entity.js';

// Datos de prueba para los tests unitarios: cada builder crea una entidad
// válida con valores por defecto, y el test solo pisa lo que le importa.
// Los ids son UUID fijos y legibles para que los errores se entiendan.

export const IDS = {
  ust: '00000000-0000-4000-8000-0000000000a1',
  otherUniversity: '00000000-0000-4000-8000-0000000000a2',
  ana: '00000000-0000-4000-8000-0000000000b1',
  beto: '00000000-0000-4000-8000-0000000000b2',
  admin: '00000000-0000-4000-8000-0000000000b3',
  ustPanel: '00000000-0000-4000-8000-0000000000c1',
  generalPanel: '00000000-0000-4000-8000-0000000000c2',
  forum: '00000000-0000-4000-8000-0000000000d1',
  post: '00000000-0000-4000-8000-0000000000e1',
} as const;

const CREATED_AT = new Date('2026-11-01T12:00:00.000Z');

export function makeUniversity(overrides: Partial<UniversityEntity> = {}): UniversityEntity {
  const u = {
    id: IDS.ust,
    slug: 'ustavillavo',
    name: 'UST Villavicencio',
    emailDomain: 'ustavillavo.edu.co',
    ...overrides,
  };
  return new UniversityEntity(u.id, u.slug, u.name, u.emailDomain, CREATED_AT);
}

export function makeProfile(
  overrides: Partial<{
    id: string;
    username: string;
    universityId: string;
    role: ProfileRole;
  }> = {},
): ProfileEntity {
  const p = {
    id: IDS.ana,
    username: 'ana',
    universityId: IDS.ust,
    role: 'user' as ProfileRole,
    ...overrides,
  };
  return new ProfileEntity(p.id, p.username, p.universityId, p.role, CREATED_AT);
}

export function makePanel(
  overrides: Partial<{ id: string; universityId: string | null; slug: string }> = {},
): PanelEntity {
  const p = {
    id: IDS.ustPanel,
    universityId: IDS.ust as string | null,
    slug: 'ustavillavo',
    ...overrides,
  };
  return new PanelEntity(p.id, p.universityId, p.slug, p.slug, CREATED_AT);
}

export function makeGeneralPanel(): PanelEntity {
  return makePanel({ id: IDS.generalPanel, universityId: null, slug: PanelEntity.GENERAL_SLUG });
}

export function makeForum(
  overrides: Partial<{ id: string; panelId: string; createdBy: string }> = {},
): ForumEntity {
  const f = { id: IDS.forum, panelId: IDS.ustPanel, createdBy: IDS.ana, ...overrides };
  return new ForumEntity(f.id, f.panelId, 'calculo', 'Cálculo', f.createdBy, CREATED_AT);
}

export function makePost(
  overrides: Partial<{ id: string; forumId: string; authorId: string; score: number }> = {},
): PostEntity {
  const p = { id: IDS.post, forumId: IDS.forum, authorId: IDS.ana, score: 0, ...overrides };
  return new PostEntity(p.id, p.forumId, p.authorId, 'Hola', 'Cuerpo', p.score, 0, CREATED_AT);
}

export function makeComment(
  overrides: Partial<{
    id: string;
    postId: string;
    parentId: string | null;
    authorId: string;
    score: number;
    deletedAt: Date | null;
    createdAt: Date;
  }> = {},
): CommentEntity {
  const c = {
    id: '00000000-0000-4000-8000-0000000000f1',
    postId: IDS.post,
    parentId: null as string | null,
    authorId: IDS.ana,
    score: 0,
    deletedAt: null as Date | null,
    createdAt: CREATED_AT,
    ...overrides,
  };
  return new CommentEntity(
    c.id,
    c.postId,
    c.parentId,
    c.authorId,
    'texto',
    c.score,
    c.deletedAt,
    c.createdAt,
  );
}

export function makeAuthor(overrides: Partial<Author> = {}): Author {
  return {
    id: IDS.ana,
    username: 'ana',
    university: { id: IDS.ust, slug: 'ustavillavo', name: 'UST Villavicencio' },
    ...overrides,
  };
}
