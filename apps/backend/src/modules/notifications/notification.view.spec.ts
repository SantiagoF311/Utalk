import { describe, expect, it } from '@jest/globals';
import { notificationSchema } from '@utalk/shared';
import { IDS, makeNotification } from '../../testing/fixtures.js';
import type { NotificationWithTarget } from './domain/notification.repository.js';
import { toNotificationPush, toNotificationView } from './notification.view.js';

const COMMENT_ID = '00000000-0000-4000-8000-0000000000f1';

function item(overrides: Partial<NotificationWithTarget>): NotificationWithTarget {
  return {
    notification: makeNotification(),
    post: { id: IDS.post, title: 'Hola' },
    community: { id: IDS.community, slug: 'calculo', name: 'Cálculo' },
    report: null,
    ...overrides,
  };
}

describe('toNotificationView', () => {
  it('post nuevo: solo el post y su comunidad', () => {
    const view = toNotificationView(item({}));

    expect(view).toEqual({
      id: IDS.notification,
      type: 'new_post_in_community',
      post: { id: IDS.post, title: 'Hola' },
      community: { id: IDS.community, slug: 'calculo', name: 'Cálculo' },
      readAt: null,
      createdAt: '2026-11-01T12:00:00.000Z',
    });
    expect(notificationSchema.safeParse(view).success).toBe(true);
  });

  it('reporte resuelto: el caso, en qué quedó y si era el post o un comentario', () => {
    const view = toNotificationView(
      item({
        notification: makeNotification({ type: 'report_resolved', commentId: COMMENT_ID }),
        report: { caseNumber: 42, status: 'dismissed' },
      }),
    );

    expect(view).toMatchObject({
      type: 'report_resolved',
      target: 'comment',
      report: { caseNumber: 42, outcome: 'dismissed' },
    });
    expect(notificationSchema.safeParse(view).success).toBe(true);
  });

  it('contenido eliminado: si era el post o un comentario, sin datos del reporte', () => {
    const view = toNotificationView(
      item({ notification: makeNotification({ type: 'content_removed' }) }),
    );

    expect(view).toMatchObject({ type: 'content_removed', target: 'post' });
    expect(view).not.toHaveProperty('report');
    expect(notificationSchema.safeParse(view).success).toBe(true);
  });

  it('publicación retenida por la IA: solo el post y su comunidad', () => {
    const view = toNotificationView(
      item({ notification: makeNotification({ type: 'content_held' }) }),
    );

    expect(view).toMatchObject({ type: 'content_held', post: { id: IDS.post } });
    expect(view).not.toHaveProperty('target');
    expect(notificationSchema.safeParse(view).success).toBe(true);
  });

  it('contenido que un moderador dejó: si era el post o un comentario, sin el reporte', () => {
    const view = toNotificationView(
      item({
        notification: makeNotification({ type: 'content_kept', commentId: COMMENT_ID }),
        report: { caseNumber: 7, status: 'dismissed' },
      }),
    );

    expect(view).toMatchObject({ type: 'content_kept', target: 'comment' });
    expect(view).not.toHaveProperty('report');
    expect(notificationSchema.safeParse(view).success).toBe(true);
  });

  it('un aviso de reporte sin su reporte es un error (la base no lo permite)', () => {
    expect(() =>
      toNotificationView(item({ notification: makeNotification({ type: 'report_resolved' }) })),
    ).toThrow();
  });
});

describe('toNotificationPush', () => {
  it('va a quien es la notificación y dice lo mismo que la lista', () => {
    const push = toNotificationPush(
      item({ notification: makeNotification({ type: 'content_kept', userId: IDS.ana }) }),
    );

    expect(push).toEqual({
      recipientId: IDS.ana,
      title: 'Moderación',
      body: 'Un moderador revisó tu publicación «Hola» y la dejó publicada: no incumple las normas.',
      data: { notificationId: IDS.notification, postId: IDS.post, link: 'post' },
    });
  });

  it('una publicación eliminada no lleva a ningún lado (ya no se puede abrir)', () => {
    const push = toNotificationPush(
      item({ notification: makeNotification({ type: 'content_removed' }) }),
    );

    expect(push.data).toMatchObject({ link: 'none' });
  });

  it('un reporte resuelto lleva a "Mis reportes"', () => {
    const push = toNotificationPush(
      item({
        notification: makeNotification({ type: 'report_resolved' }),
        report: { caseNumber: 42, status: 'removed' },
      }),
    );

    expect(push).toMatchObject({ title: 'Tu reporte · caso #42', data: { link: 'my-reports' } });
  });
});
