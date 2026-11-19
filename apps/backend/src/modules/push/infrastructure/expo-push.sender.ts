import { Injectable } from '@nestjs/common';
import type { PushMessage, PushSender } from '../domain/push.sender.js';

// Servicio de push de Expo: recibe los avisos y los entrega por Apple (iOS)
// o Firebase (Android). No necesita clave para proyectos sin "push security".
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo acepta hasta 100 avisos por pedido.
const BATCH_SIZE = 100;

// Respuesta de Expo: un "ticket" por aviso, en el mismo orden.
interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

@Injectable()
export class ExpoPushSender implements PushSender {
  async send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }> {
    const invalidTokens: string[] = [];

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(
          batch.map((message) => ({
            to: message.token,
            title: message.title,
            body: message.body,
            data: message.data,
            sound: 'default',
            priority: 'high',
          })),
        ),
      });

      // Un error de todo el pedido (Expo caído, pedido inválido): BullMQ
      // reintenta el job.
      if (!response.ok) {
        throw new Error(`Expo push failed with ${response.status}: ${await response.text()}`);
      }

      const { data } = (await response.json()) as { data: ExpoTicket[] };
      data.forEach((ticket, index) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(batch[index].token);
        }
      });
    }

    return { invalidTokens };
  }
}
