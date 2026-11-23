import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { NOTIFICATIONS_LIMIT } from '@utalk/shared';
import { IDS, makeNotification } from '../../testing/fixtures.js';
import type { NotificationQueue } from './domain/notification.queue.js';
import type { PushService } from '../push/push.service.js';
import type {
  NotificationRepository,
  NotificationWithTarget,
} from './domain/notification.repository.js';
import { NotificationsService } from './notifications.service.js';

const OTHER_NOTIFICATION = '00000000-0000-4000-8000-000000000402';

function withTarget(userId: string, id: string = IDS.notification): NotificationWithTarget {
  return {
    notification: makeNotification({ id, userId }),
    post: { id: IDS.post, title: 'Parcial de cálculo' },
    community: { id: IDS.community, slug: 'calculo', name: 'Cálculo' },
    report: null,
  };
}

describe('NotificationsService', () => {
  let repository: jest.Mocked<NotificationRepository>;
  let queue: jest.Mocked<NotificationQueue>;
  let pushService: jest.Mocked<Pick<PushService, 'enqueueToUsers'>>;
  let service: NotificationsService;

  beforeEach(() => {
    repository = {
      createForNewPost: jest
        .fn<NotificationRepository['createForNewPost']>()
        .mockResolvedValue([IDS.notification, OTHER_NOTIFICATION]),
      createForModerationResult: jest
        .fn<NotificationRepository['createForModerationResult']>()
        .mockResolvedValue([IDS.notification]),
      findById: jest.fn<NotificationRepository['findById']>().mockResolvedValue(makeNotification()),
      findManyWithTarget: jest
        .fn<NotificationRepository['findManyWithTarget']>()
        .mockResolvedValue([withTarget(IDS.beto), withTarget(IDS.ana, OTHER_NOTIFICATION)]),
      findLatestByUser: jest.fn<NotificationRepository['findLatestByUser']>().mockResolvedValue([]),
      countUnread: jest.fn<NotificationRepository['countUnread']>().mockResolvedValue(3),
      markRead: jest.fn<NotificationRepository['markRead']>().mockResolvedValue(undefined),
      markAllRead: jest.fn<NotificationRepository['markAllRead']>().mockResolvedValue(undefined),
      delete: jest.fn<NotificationRepository['delete']>().mockResolvedValue(undefined),
      deleteAllByUser: jest
        .fn<NotificationRepository['deleteAllByUser']>()
        .mockResolvedValue(undefined),
    };
    queue = {
      enqueueNewPost: jest.fn<NotificationQueue['enqueueNewPost']>().mockResolvedValue(undefined),
      enqueueModerationResult: jest
        .fn<NotificationQueue['enqueueModerationResult']>()
        .mockResolvedValue(undefined),
    };
    pushService = {
      enqueueToUsers: jest.fn<PushService['enqueueToUsers']>().mockResolvedValue(undefined),
    };
    service = new NotificationsService(repository, queue, pushService as unknown as PushService);
  });

  describe('avisos de moderación', () => {
    const removedPost = { postId: IDS.post, commentId: null };

    it('encola el contenido resuelto', async () => {
      await service.enqueueModerationResult(removedPost);

      expect(queue.enqueueModerationResult).toHaveBeenCalledWith(removedPost);
    });

    it('no falla si la cola no responde: la resolución ya quedó hecha', async () => {
      queue.enqueueModerationResult.mockRejectedValue(new Error('Redis down'));
      const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(service.enqueueModerationResult(removedPost)).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalled();
      logError.mockRestore();
    });

    it('el worker crea los avisos, los manda por push y devuelve cuántos', async () => {
      await expect(service.notifyModerationResult(removedPost)).resolves.toBe(1);
      expect(repository.createForModerationResult).toHaveBeenCalledWith(removedPost);
      expect(repository.findManyWithTarget).toHaveBeenCalledWith([IDS.notification]);
      expect(pushService.enqueueToUsers).toHaveBeenCalled();
    });
  });

  describe('enqueueNewPost', () => {
    it('encola el post', async () => {
      await service.enqueueNewPost(IDS.post);

      expect(queue.enqueueNewPost).toHaveBeenCalledWith(IDS.post);
    });

    it('no falla si la cola no responde: el post ya está publicado', async () => {
      queue.enqueueNewPost.mockRejectedValue(new Error('Redis down'));
      const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(service.enqueueNewPost(IDS.post)).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalled();
      logError.mockRestore();
    });
  });

  describe('notifySubscribers', () => {
    it('crea las notificaciones del post y devuelve cuántas', async () => {
      await expect(service.notifySubscribers(IDS.post)).resolves.toBe(2);
      expect(repository.createForNewPost).toHaveBeenCalledWith(IDS.post);
    });

    it('manda un push por notificación, a su destinatario y con lo que dice la lista', async () => {
      await service.notifySubscribers(IDS.post);

      expect(pushService.enqueueToUsers).toHaveBeenCalledWith([
        {
          recipientId: IDS.beto,
          title: 'Nueva publicación en c/calculo',
          body: 'Parcial de cálculo',
          data: { notificationId: IDS.notification, postId: IDS.post, link: 'post' },
        },
        expect.objectContaining({ recipientId: IDS.ana }),
      ]);
    });

    it('un reintento no crea notificaciones ni repite el push', async () => {
      repository.createForNewPost.mockResolvedValue([]);

      await expect(service.notifySubscribers(IDS.post)).resolves.toBe(0);
      expect(pushService.enqueueToUsers).not.toHaveBeenCalled();
    });

    it('si el push falla no falla el job: las notificaciones ya están creadas', async () => {
      repository.findManyWithTarget.mockRejectedValue(new Error('Supabase down'));
      const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(service.notifySubscribers(IDS.post)).resolves.toBe(2);
      expect(logError).toHaveBeenCalled();
      logError.mockRestore();
    });
  });

  describe('findMine', () => {
    it('pide las más nuevas de quien mira, con el límite compartido', async () => {
      await service.findMine(IDS.beto);

      expect(repository.findLatestByUser).toHaveBeenCalledWith(IDS.beto, NOTIFICATIONS_LIMIT);
    });
  });

  describe('markRead', () => {
    it('marca como leída una notificación propia sin leer', async () => {
      await service.markRead(IDS.notification, IDS.beto);

      expect(repository.markRead).toHaveBeenCalledWith(IDS.notification);
    });

    it('es idempotente: una ya leída no se vuelve a escribir', async () => {
      repository.findById.mockResolvedValue(makeNotification({ readAt: new Date() }));

      await expect(service.markRead(IDS.notification, IDS.beto)).resolves.toBeUndefined();
      expect(repository.markRead).not.toHaveBeenCalled();
    });

    it('NOTIFICATION_NOT_FOUND si no existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.markRead(IDS.notification, IDS.beto)).rejects.toMatchObject({
        code: 'NOTIFICATION_NOT_FOUND',
      });
    });

    it('NOTIFICATION_NOT_FOUND si es de otro usuario (no revela que existe)', async () => {
      await expect(service.markRead(IDS.notification, IDS.ana)).rejects.toMatchObject({
        code: 'NOTIFICATION_NOT_FOUND',
      });
      expect(repository.markRead).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('elimina una notificación propia', async () => {
      await service.remove(IDS.notification, IDS.beto);

      expect(repository.delete).toHaveBeenCalledWith(IDS.notification);
    });

    it('NOTIFICATION_NOT_FOUND si no existe (o ya se eliminó)', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove(IDS.notification, IDS.beto)).rejects.toMatchObject({
        code: 'NOTIFICATION_NOT_FOUND',
      });
    });

    it('NOTIFICATION_NOT_FOUND si es de otro usuario: no la elimina', async () => {
      await expect(service.remove(IDS.notification, IDS.ana)).rejects.toMatchObject({
        code: 'NOTIFICATION_NOT_FOUND',
      });
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('removeAll', () => {
    it('elimina solo las de quien pregunta', async () => {
      await service.removeAll(IDS.beto);

      expect(repository.deleteAllByUser).toHaveBeenCalledWith(IDS.beto);
    });
  });

  describe('markAllRead', () => {
    it('marca todas las de quien mira', async () => {
      await service.markAllRead(IDS.beto);

      expect(repository.markAllRead).toHaveBeenCalledWith(IDS.beto);
    });
  });
});
