import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { IDS } from '../../testing/fixtures.js';
import type { PushQueue } from './domain/push.queue.js';
import type { PushSender } from './domain/push.sender.js';
import { PushTokenEntity } from './domain/pushToken.entity.js';
import type { PushTokenRepository } from './domain/pushToken.repository.js';
import { PushService } from './push.service.js';

const PHONE = 'ExponentPushToken[telefono-de-beto]';
const TABLET = 'ExponentPushToken[tablet-de-beto]';
const job = {
  recipientId: IDS.beto,
  conversationId: IDS.conversation,
  senderUsername: 'ana',
  preview: 'hola',
};

describe('PushService', () => {
  let tokens: jest.Mocked<PushTokenRepository>;
  let sender: jest.Mocked<PushSender>;
  let queue: jest.Mocked<PushQueue>;
  let service: PushService;

  beforeEach(() => {
    tokens = {
      upsert: jest.fn<PushTokenRepository['upsert']>().mockResolvedValue(undefined),
      deleteOwned: jest.fn<PushTokenRepository['deleteOwned']>().mockResolvedValue(undefined),
      findByUser: jest
        .fn<PushTokenRepository['findByUser']>()
        .mockResolvedValue([
          new PushTokenEntity(PHONE, IDS.beto, 'ios', new Date()),
          new PushTokenEntity(TABLET, IDS.beto, 'android', new Date()),
        ]),
      deleteMany: jest.fn<PushTokenRepository['deleteMany']>().mockResolvedValue(undefined),
    };
    sender = {
      send: jest.fn<PushSender['send']>().mockResolvedValue({ invalidTokens: [] }),
    };
    queue = {
      enqueueNewMessage: jest.fn<PushQueue['enqueueNewMessage']>().mockResolvedValue(undefined),
    };
    service = new PushService(tokens, sender, queue);
  });

  describe('register / unregister', () => {
    it('registra el celular para quien tiene la sesión', async () => {
      await service.register({ token: PHONE, platform: 'ios' }, IDS.beto);

      expect(tokens.upsert).toHaveBeenCalledWith(PHONE, IDS.beto, 'ios');
    });

    it('al cerrar sesión borra solo el token de esa persona', async () => {
      await service.unregister(PHONE, IDS.beto);

      expect(tokens.deleteOwned).toHaveBeenCalledWith(PHONE, IDS.beto);
    });
  });

  describe('enqueueNewMessage', () => {
    const message = {
      conversationId: IDS.conversation,
      recipientId: IDS.beto,
      senderUsername: 'ana',
      body: 'hola\nqué tal',
    };

    it('en una conversación aceptada encola el comienzo del mensaje', async () => {
      await service.enqueueNewMessage({ ...message, isRequest: false });

      expect(queue.enqueueNewMessage).toHaveBeenCalledWith({
        recipientId: IDS.beto,
        conversationId: IDS.conversation,
        senderUsername: 'ana',
        preview: 'hola qué tal',
      });
    });

    it('en una solicitud no encola el texto (ni llega a Redis)', async () => {
      await service.enqueueNewMessage({ ...message, isRequest: true });

      expect(queue.enqueueNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({ preview: null }),
      );
    });

    it('no falla si la cola no responde: el mensaje ya está guardado', async () => {
      queue.enqueueNewMessage.mockRejectedValue(new Error('Redis down'));
      const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(
        service.enqueueNewMessage({ ...message, isRequest: false }),
      ).resolves.toBeUndefined();
      logError.mockRestore();
    });
  });

  describe('deliverNewMessage', () => {
    it('manda el aviso a cada celular del destinatario, con la conversación para abrirla', async () => {
      await expect(service.deliverNewMessage(job)).resolves.toBe(2);

      expect(sender.send).toHaveBeenCalledWith([
        { token: PHONE, title: 'u/ana', body: 'hola', data: { conversationId: IDS.conversation } },
        { token: TABLET, title: 'u/ana', body: 'hola', data: { conversationId: IDS.conversation } },
      ]);
    });

    it('borra los tokens que Expo dice que ya no existen', async () => {
      sender.send.mockResolvedValue({ invalidTokens: [TABLET] });

      await expect(service.deliverNewMessage(job)).resolves.toBe(1);
      expect(tokens.deleteMany).toHaveBeenCalledWith([TABLET]);
    });

    it('sin celulares registrados no manda nada', async () => {
      tokens.findByUser.mockResolvedValue([]);

      await expect(service.deliverNewMessage(job)).resolves.toBe(0);
      expect(sender.send).not.toHaveBeenCalled();
    });
  });
});
