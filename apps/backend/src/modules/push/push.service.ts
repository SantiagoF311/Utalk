import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NotifyNewMessageJob, RegisterPushTokenInput } from '@utalk/shared';
import { PUSH_QUEUE } from './domain/push.queue.js';
import type { PushQueue } from './domain/push.queue.js';
import { PUSH_SENDER } from './domain/push.sender.js';
import type { PushSender } from './domain/push.sender.js';
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
