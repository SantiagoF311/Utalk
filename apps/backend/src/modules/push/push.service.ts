import { Inject, Injectable, Logger } from '@nestjs/common';
import { PUSH_JOB_MAX_MESSAGES } from '@utalk/shared';
import type { NotifyNewMessageJob, NotifyUsersJob, RegisterPushTokenInput } from '@utalk/shared';
import { PUSH_QUEUE } from './domain/push.queue.js';
import type { PushQueue } from './domain/push.queue.js';
import { PUSH_SENDER } from './domain/push.sender.js';
import type { PushMessage, PushSender } from './domain/push.sender.js';
import { messagePreview, newMessagePushContent } from './domain/pushContent.js';
import { PUSH_TOKEN_REPOSITORY } from './domain/pushToken.repository.js';
import type { PushTokenRepository } from './domain/pushToken.repository.js';

// Lo que el chat sabe de un mensaje recién mandado.
export interface NewMessage {
  conversationId: string;
  recipientId: string;
  senderUsername: string;
  body: string;
  // Primer mensaje a alguien con quien no había conversación.
  isRequest: boolean;
}

// Un aviso ya armado para alguien (le llega a todos sus celulares).
export type UserPush = NotifyUsersJob['messages'][number];

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(PUSH_TOKEN_REPOSITORY) private readonly pushTokenRepository: PushTokenRepository,
    @Inject(PUSH_SENDER) private readonly pushSender: PushSender,
    @Inject(PUSH_QUEUE) private readonly pushQueue: PushQueue,
  ) {}

  // Al abrir la app con sesión. Idempotente.
  async register(input: RegisterPushTokenInput, userId: string): Promise<void> {
    await this.pushTokenRepository.upsert(input.token, userId, input.platform);
  }

  // Al cerrar sesión: ese celular deja de recibir avisos de esta cuenta.
  // Idempotente; el token de otro usuario no se toca.
  async unregister(token: string, userId: string): Promise<void> {
    await this.pushTokenRepository.deleteOwned(token, userId);
  }

  // Lo llama el chat al mandar un mensaje. Nunca falla: el mensaje ya está
  // guardado (y llega por Realtime); si la cola no responde, solo se pierde
  // el aviso con la app cerrada.
  async enqueueNewMessage(message: NewMessage): Promise<void> {
    const job: NotifyNewMessageJob = {
      recipientId: message.recipientId,
      conversationId: message.conversationId,
      senderUsername: message.senderUsername,
      preview: message.isRequest ? null : messagePreview(message.body),
    };
    try {
      await this.pushQueue.enqueueNewMessage(job);
    } catch (error) {
      this.logger.error(`Could not enqueue push for conversation ${job.conversationId}`, error);
    }
  }

  // Lo llaman las notificaciones con los avisos ya armados (uno por
  // destinatario). Nunca falla, igual que con los mensajes: la notificación
  // ya está guardada (y se ve en la campana); si la cola no responde, solo
  // se pierde el push. Van en tandas para que un job no sea enorme.
  async enqueueToUsers(messages: UserPush[]): Promise<void> {
    for (let i = 0; i < messages.length; i += PUSH_JOB_MAX_MESSAGES) {
      const batch = messages.slice(i, i + PUSH_JOB_MAX_MESSAGES);
      try {
        await this.pushQueue.enqueueUsers({ messages: batch });
      } catch (error) {
        this.logger.error(`Could not enqueue push for ${batch.length} users`, error);
      }
    }
  }

  // Lo corre el worker: cada aviso a todos los celulares de su destinatario
  // (quien no tiene ninguno, no recibe nada). Devuelve a cuántos se entregó.
  async deliverToUsers(job: NotifyUsersJob): Promise<number> {
    const recipientIds = [...new Set(job.messages.map((message) => message.recipientId))];
    const tokens = await this.pushTokenRepository.findByUsers(recipientIds);
    if (tokens.length === 0) return 0;

    const pushes: PushMessage[] = job.messages.flatMap(({ recipientId, title, body, data }) =>
      tokens
        .filter((token) => token.belongsTo(recipientId))
        .map(({ token }) => ({ token, title, body, data })),
    );
    const { invalidTokens } = await this.pushSender.send(pushes);
    await this.pushTokenRepository.deleteMany(invalidTokens);
    return pushes.length - invalidTokens.length;
  }

  // Lo corre el worker: manda el aviso a cada celular del destinatario y
  // borra los que ya no existen. Devuelve a cuántos se entregó.
  async deliverNewMessage(job: NotifyNewMessageJob): Promise<number> {
    const tokens = await this.pushTokenRepository.findByUser(job.recipientId);
    if (tokens.length === 0) return 0;

    const content = newMessagePushContent(job);
    const { invalidTokens } = await this.pushSender.send(
      tokens.map(({ token }) => ({
        token,
        ...content,
        data: { conversationId: job.conversationId },
      })),
    );
    await this.pushTokenRepository.deleteMany(invalidTokens);
    return tokens.length - invalidTokens.length;
  }
}
