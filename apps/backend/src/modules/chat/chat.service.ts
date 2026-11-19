import { Inject, Injectable } from '@nestjs/common';
import type { MessagePageQuery, SendMessageInput, StartConversationInput } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { BlocksService } from '../blocks/blocks.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { PushService } from '../push/push.service.js';
import { ConversationEntity } from './domain/conversation.entity.js';
import { CONVERSATION_REPOSITORY } from './domain/conversation.repository.js';
import type {
  ConversationRepository,
  ConversationSummary,
} from './domain/conversation.repository.js';
import { MessageEntity } from './domain/message.entity.js';
import { MESSAGE_REPOSITORY } from './domain/message.repository.js';
import type { MessagePage, MessageRepository } from './domain/message.repository.js';

@Injectable()
export class ChatService {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messageRepository: MessageRepository,
    private readonly profilesService: ProfilesService,
    private readonly blocksService: BlocksService,
    private readonly pushService: PushService,
  ) {}

  // La lista de Chats (y de solicitudes: el mobile separa por estado).
  async findMine(userId: string): Promise<ConversationSummary[]> {
    return this.conversationRepository.findSummaries(userId);
  }

  async findSummary(conversationId: string, userId: string): Promise<ConversationSummary> {
    const [summary] = await this.conversationRepository.findSummaries(userId, conversationId);
    // Tampoco existe para quien no participa (no se confirma que exista).
    if (!summary) {
      throw new AppException('CONVERSATION_NOT_FOUND', `Conversation ${conversationId} not found`);
    }
    return summary;
  }

  // La conversación con alguien, si ya existe (desde su perfil: abrirla en
  // vez de empezar otra).
  async findWith(otherUserId: string, userId: string): Promise<ConversationSummary> {
    const conversation = await this.conversationRepository.findBetween(userId, otherUserId);
    if (!conversation) {
      throw new AppException('CONVERSATION_NOT_FOUND', `No conversation with user ${otherUserId}`);
    }
    return this.findSummary(conversation.id, userId);
  }

  // Escribirle a alguien. Si no había conversación, nace como solicitud con
  // este primer mensaje; si ya había, el mensaje va a esa (con sus reglas).
  async start(
    input: StartConversationInput,
    senderId: string,
  ): Promise<{ summary: ConversationSummary; message: MessageEntity }> {
    if (input.recipientId === senderId) {
      throw new AppException('CANNOT_MESSAGE_SELF', 'You cannot message yourself');
    }
    // 404 explícito si esa persona no existe.
    await this.profilesService.findById(input.recipientId);
    await this.assertNotBlocked(senderId, input.recipientId);

    const existing = await this.conversationRepository.findBetween(senderId, input.recipientId);
    let message: MessageEntity;
    let conversationId: string;
    if (existing) {
      message = await this.sendTo(existing, senderId, input.body);
      conversationId = existing.id;
    } else {
      const started = await this.conversationRepository.start(
        senderId,
        input.recipientId,
        input.body,
      );
      conversationId = started.conversationId;
      message = await this.findMessage(started.messageId);
    }

    // Si no había conversación, es una solicitud: el aviso no muestra el texto.
    await this.notifyRecipient(message, input.recipientId, !existing);
    return { summary: await this.findSummary(conversationId, senderId), message };
  }

  async send(
    conversationId: string,
    input: SendMessageInput,
    senderId: string,
  ): Promise<MessageEntity> {
    const conversation = await this.findParticipating(conversationId, senderId);
    const recipientId = conversation.otherParticipant(senderId);
    await this.assertNotBlocked(senderId, recipientId);
    const message = await this.sendTo(conversation, senderId, input.body);
    // Acá nunca es una solicitud: quien la mandó no puede volver a escribir
    // hasta que la acepten, y responderla la acepta.
    await this.notifyRecipient(message, recipientId, false);
    return message;
  }

  async findMessages(
    conversationId: string,
    query: MessagePageQuery,
    userId: string,
  ): Promise<MessagePage> {
    await this.findParticipating(conversationId, userId);
    return this.messageRepository.findPage({
      conversationId,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  // Al abrir la conversación: todo lo que le mandaron queda leído (el otro
  // ve "Visto" por Realtime). En una solicitud recibida no: quien la mandó
  // no sabe si la viste hasta que respondas.
  async markRead(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.findParticipating(conversationId, userId);
    if (!conversation.showsReadReceiptsTo(userId)) return;
    await this.messageRepository.markRead(conversationId, userId);
  }

  private async sendTo(
    conversation: ConversationEntity,
    senderId: string,
    body: string,
  ): Promise<MessageEntity> {
    // Quien mandó la solicitud no puede seguir escribiendo hasta que la
    // otra persona responda: así un desconocido no llena el chat de nadie.
    if (!conversation.canSend(senderId)) {
      throw new AppException(
        'MESSAGE_REQUEST_PENDING',
        `Conversation ${conversation.id} has not been accepted yet`,
      );
    }
    // Responder una solicitud la acepta. Se acepta antes de insertar: si el
    // insert fallara, queda aceptada sin respuesta, que no le hace daño a
    // nadie (al revés, quedaría un mensaje en una solicitud "sin responder").
    if (conversation.isAcceptedBySending(senderId)) {
      await this.conversationRepository.accept(conversation.id);
    }
    return this.messageRepository.create({ conversationId: conversation.id, senderId, body });
  }

  // Aviso al celular del otro (si tiene la app cerrada). Solo se encola: lo
  // manda el worker de la cola `push`, y si la cola falla el mensaje igual
  // quedó guardado.
  private async notifyRecipient(
    message: MessageEntity,
    recipientId: string,
    isRequest: boolean,
  ): Promise<void> {
    const sender = await this.profilesService.findById(message.senderId);
    await this.pushService.enqueueNewMessage({
      conversationId: message.conversationId,
      recipientId,
      senderUsername: sender.username,
      body: message.body,
      isRequest,
    });
  }

  // La conversación, si quien pregunta participa. Si no, 404 (no se
  // confirma que exista).
  private async findParticipating(
    conversationId: string,
    userId: string,
  ): Promise<ConversationEntity> {
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation?.hasParticipant(userId)) {
      throw new AppException('CONVERSATION_NOT_FOUND', `Conversation ${conversationId} not found`);
    }
    return conversation;
  }

  // Un bloqueo, en cualquier sentido, corta los mensajes. El error no dice
  // quién bloqueó a quién.
  private async assertNotBlocked(userId: string, otherUserId: string): Promise<void> {
    if (await this.blocksService.isBlockedBetween(userId, otherUserId)) {
      throw new AppException('CANNOT_MESSAGE_USER', `Cannot message user ${otherUserId}`);
    }
  }

  private async findMessage(id: string): Promise<MessageEntity> {
    const message = await this.messageRepository.findById(id);
    if (!message) {
      // Lo acaba de crear start_conversation en la misma request.
      throw new Error(`Message ${id} not found right after creating it`);
    }
    return message;
  }
}
