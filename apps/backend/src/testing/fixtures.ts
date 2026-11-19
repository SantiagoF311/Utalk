import type { Author, NotificationType } from '@utalk/shared';
import { ConversationEntity } from '../modules/chat/domain/conversation.entity.js';
import { MessageEntity } from '../modules/chat/domain/message.entity.js';
import { NotificationEntity } from '../modules/notifications/domain/notification.entity.js';
import { CommentEntity } from '../modules/comments/domain/comment.entity.js';
import { CommunityEntity } from '../modules/communities/domain/community.entity.js';
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
  community: '00000000-0000-4000-8000-0000000000d1',
  post: '00000000-0000-4000-8000-0000000000e1',
  conversation: '00000000-0000-4000-8000-000000000101',
  notification: '00000000-0000-4000-8000-000000000401',
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
    isPrivate: boolean;
    usernameChangedAt: Date | null;
  }> = {},
): ProfileEntity {
  const p = {
    id: IDS.ana,
    username: 'ana',
    universityId: IDS.ust,
    role: 'user' as ProfileRole,
    isPrivate: false,
    usernameChangedAt: null as Date | null,
    ...overrides,
  };
  return new ProfileEntity(
    p.id,
    p.username,
    p.universityId,
    p.role,
    p.isPrivate,
    p.usernameChangedAt,
    CREATED_AT,
  );
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

export function makeCommunity(
  overrides: Partial<{ id: string; panelId: string; createdBy: string; memberCount: number }> = {},
): CommunityEntity {
  const f = {
    id: IDS.community,
    panelId: IDS.ustPanel,
    createdBy: IDS.ana,
    memberCount: 1,
    ...overrides,
  };
  return new CommunityEntity(
    f.id,
    f.panelId,
    'calculo',
    'Cálculo',
    'Parciales, talleres y dudas de cálculo',
    'academic',
    f.memberCount,
    f.createdBy,
    CREATED_AT,
  );
}

export function makePost(
  overrides: Partial<{
    id: string;
    communityId: string;
    authorId: string;
    score: number;
    removedAt: Date | null;
    imagePath: string | null;
  }> = {},
): PostEntity {
  const p = {
    id: IDS.post,
    communityId: IDS.community,
    authorId: IDS.ana,
    score: 0,
    removedAt: null as Date | null,
    imagePath: null as string | null,
    ...overrides,
  };
  return new PostEntity(
    p.id,
    p.communityId,
    p.authorId,
    'Hola',
    'Cuerpo',
    p.score,
    0,
    CREATED_AT,
    p.removedAt,
    p.imagePath,
  );
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
    removedAt: Date | null;
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
    removedAt: null as Date | null,
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
    c.removedAt,
  );
}

// Conversación entre Ana y Beto que empezó Ana. Por defecto, solicitud
// (acceptedAt null).
export function makeConversation(
  overrides: Partial<{ id: string; initiatedBy: string; acceptedAt: Date | null }> = {},
): ConversationEntity {
  const c = {
    id: IDS.conversation,
    initiatedBy: IDS.ana as string,
    acceptedAt: null as Date | null,
    ...overrides,
  };
  // user_a < user_b, como en la base.
  const [userA, userB] = [IDS.ana, IDS.beto].sort();
  return new ConversationEntity(
    c.id,
    userA,
    userB,
    c.initiatedBy,
    c.acceptedAt,
    CREATED_AT,
    CREATED_AT,
  );
}

export function makeMessage(
  overrides: Partial<{ id: string; senderId: string; body: string; readAt: Date | null }> = {},
): MessageEntity {
  const m = {
    id: '00000000-0000-4000-8000-000000000301',
    senderId: IDS.ana as string,
    body: 'hola',
    readAt: null as Date | null,
    ...overrides,
  };
  return new MessageEntity(m.id, IDS.conversation, m.senderId, m.body, m.readAt, CREATED_AT);
}

// Notificación para Beto. Por defecto: Ana publicó en una comunidad de la
// que es miembro, sin leer.
export function makeNotification(
  overrides: Partial<{
    id: string;
    userId: string;
    type: NotificationType;
    commentId: string | null;
    readAt: Date | null;
  }> = {},
): NotificationEntity {
  const n = {
    id: IDS.notification,
    userId: IDS.beto as string,
    type: 'new_post_in_community' as NotificationType,
    commentId: null as string | null,
    readAt: null as Date | null,
    ...overrides,
  };
  return new NotificationEntity(
    n.id,
    n.userId,
    n.type,
    IDS.post,
    n.commentId,
    n.readAt,
    CREATED_AT,
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
