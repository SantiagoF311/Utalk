import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppException } from '../../common/appException.js';
import {
  IDS,
  makeAuthor,
  makeConversation,
  makeMessage,
  makeProfile,
} from '../../testing/fixtures.js';
import type { BlocksService } from '../blocks/blocks.service.js';
import type { ProfilesService } from '../profiles/profiles.service.js';
import { ChatService } from './chat.service.js';
import type { ConversationEntity } from './domain/conversation.entity.js';
import type {
  ConversationRepository,
  ConversationSummary,
} from './domain/conversation.repository.js';
import type { MessageRepository } from './domain/message.repository.js';

const STRANGER = '00000000-0000-4000-8000-0000000000b9';
const NEW_MESSAGE_ID = '00000000-0000-4000-8000-000000000302';

const summaryOf = (conversation: ConversationEntity): ConversationSummary => ({
  conversation,
  otherUser: makeAuthor({ id: IDS.beto, username: 'beto' }),
  lastMessage: null,
  unreadCount: 0,
  blockedByMe: false,
  blockedByOther: false,
});

describe('ChatService', () => {
  let conversations: jest.Mocked<ConversationRepository>;
  let messages: jest.Mocked<MessageRepository>;
  let profiles: { findById: jest.Mock<ProfilesService['findById']> };
  let blocks: { isBlockedBetween: jest.Mock<BlocksService['isBlockedBetween']> };
  let service: ChatService;

  beforeEach(() => {
    conversations = {
      findById: jest.fn<ConversationRepository['findById']>().mockResolvedValue(makeConversation()),
      findBetween: jest.fn<ConversationRepository['findBetween']>().mockResolvedValue(null),
      start: jest
        .fn<ConversationRepository['start']>()
        .mockResolvedValue({ conversationId: IDS.conversation, messageId: NEW_MESSAGE_ID }),
      accept: jest.fn<ConversationRepository['accept']>().mockResolvedValue(undefined),
      findSummaries: jest
        .fn<ConversationRepository['findSummaries']>()
        .mockResolvedValue([summaryOf(makeConversation())]),
    };
    messages = {
      create: jest
        .fn<MessageRepository['create']>()
        .mockImplementation((message) =>
          Promise.resolve(makeMessage({ senderId: message.senderId, body: message.body })),
        ),
      findById: jest
        .fn<MessageRepository['findById']>()
        .mockResolvedValue(makeMessage({ id: NEW_MESSAGE_ID })),
      findPage: jest
        .fn<MessageRepository['findPage']>()
        .mockResolvedValue({ items: [], nextCursor: null }),
      markRead: jest.fn<MessageRepository['markRead']>().mockResolvedValue(undefined),
    };
    profiles = {
      findById: jest
        .fn<ProfilesService['findById']>()
        .mockResolvedValue(makeProfile({ id: IDS.beto })),
    };
    blocks = {
      isBlockedBetween: jest.fn<BlocksService['isBlockedBetween']>().mockResolvedValue(false),
    };

    service = new ChatService(
      conversations,
      messages,
      profiles as unknown as ProfilesService,
      blocks as unknown as BlocksService,
    );
  });

  describe('start', () => {
    it('sin conversación previa, la crea como solicitud con el primer mensaje', async () => {
      const result = await service.start({ recipientId: IDS.beto, body: 'hola' }, IDS.ana);

      expect(conversations.start).toHaveBeenCalledWith(IDS.ana, IDS.beto, 'hola');
      expect(result.message.id).toBe(NEW_MESSAGE_ID);
      expect(result.summary.conversation.id).toBe(IDS.conversation);
    });

    it('si ya existe, el mensaje va a esa conversación', async () => {
      conversations.findBetween.mockResolvedValue(makeConversation({ acceptedAt: new Date() }));

      await service.start({ recipientId: IDS.beto, body: 'otra vez' }, IDS.ana);

      expect(conversations.start).not.toHaveBeenCalled();
      expect(messages.create).toHaveBeenCalledWith({
        conversationId: IDS.conversation,
        senderId: IDS.ana,
        body: 'otra vez',
      });
    });

    it('CANNOT_MESSAGE_SELF si se escribe a sí mismo', async () => {
      await expect(
        service.start({ recipientId: IDS.ana, body: 'hola' }, IDS.ana),
      ).rejects.toMatchObject({ code: 'CANNOT_MESSAGE_SELF' });
    });

    it('CANNOT_MESSAGE_USER si hay un bloqueo entre los dos', async () => {
      blocks.isBlockedBetween.mockResolvedValue(true);

      await expect(
        service.start({ recipientId: IDS.beto, body: 'hola' }, IDS.ana),
      ).rejects.toMatchObject({ code: 'CANNOT_MESSAGE_USER' });
      expect(conversations.start).not.toHaveBeenCalled();
    });

    it('propaga PROFILE_NOT_FOUND si esa persona no existe', async () => {
      profiles.findById.mockRejectedValue(new AppException('PROFILE_NOT_FOUND', 'not found'));

      await expect(
        service.start({ recipientId: IDS.beto, body: 'hola' }, IDS.ana),
      ).rejects.toMatchObject({ code: 'PROFILE_NOT_FOUND' });
    });
  });

  describe('send', () => {
    it('quien mandó la solicitud no puede volver a escribir hasta que le respondan', async () => {
      await expect(
        service.send(IDS.conversation, { body: 'hola?' }, IDS.ana),
      ).rejects.toMatchObject({ code: 'MESSAGE_REQUEST_PENDING' });
      expect(messages.create).not.toHaveBeenCalled();
    });

    it('responder una solicitud la acepta', async () => {
      await service.send(IDS.conversation, { body: 'hola!' }, IDS.beto);

      expect(conversations.accept).toHaveBeenCalledWith(IDS.conversation);
      expect(messages.create).toHaveBeenCalledWith({
        conversationId: IDS.conversation,
        senderId: IDS.beto,
        body: 'hola!',
      });
    });

    it('en una aceptada se escribe sin volver a aceptarla', async () => {
      conversations.findById.mockResolvedValue(makeConversation({ acceptedAt: new Date() }));

      await service.send(IDS.conversation, { body: 'qué tal' }, IDS.ana);

      expect(conversations.accept).not.toHaveBeenCalled();
      expect(messages.create).toHaveBeenCalled();
    });

    it('CANNOT_MESSAGE_USER si después se bloquearon', async () => {
      conversations.findById.mockResolvedValue(makeConversation({ acceptedAt: new Date() }));
      blocks.isBlockedBetween.mockResolvedValue(true);

      await expect(service.send(IDS.conversation, { body: 'hola' }, IDS.ana)).rejects.toMatchObject(
        { code: 'CANNOT_MESSAGE_USER' },
      );
    });

    it('CONVERSATION_NOT_FOUND si no participa (sin confirmar que existe)', async () => {
      await expect(
        service.send(IDS.conversation, { body: 'hola' }, STRANGER),
      ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
    });
  });

  describe('findMessages / markRead', () => {
    it('solo quien participa ve los mensajes', async () => {
      await expect(
        service.findMessages(IDS.conversation, { limit: 50 }, STRANGER),
      ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
      expect(messages.findPage).not.toHaveBeenCalled();
    });

    it('marca como leído lo que le mandaron a quien abre la conversación', async () => {
      conversations.findById.mockResolvedValue(makeConversation({ acceptedAt: new Date() }));

      await service.markRead(IDS.conversation, IDS.beto);
      expect(messages.markRead).toHaveBeenCalledWith(IDS.conversation, IDS.beto);
    });

    it('abrir una solicitud recibida no la marca como leída', async () => {
      await service.markRead(IDS.conversation, IDS.beto);
      expect(messages.markRead).not.toHaveBeenCalled();
    });
  });

  describe('findSummary / findWith', () => {
    it('CONVERSATION_NOT_FOUND si no aparece entre las suyas', async () => {
      conversations.findSummaries.mockResolvedValue([]);

      await expect(service.findSummary(IDS.conversation, IDS.ana)).rejects.toMatchObject({
        code: 'CONVERSATION_NOT_FOUND',
      });
    });

    it('findWith: CONVERSATION_NOT_FOUND si nunca hablaron', async () => {
      await expect(service.findWith(IDS.beto, IDS.ana)).rejects.toMatchObject({
        code: 'CONVERSATION_NOT_FOUND',
      });
    });
  });
});
