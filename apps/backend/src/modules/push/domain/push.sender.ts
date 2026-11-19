import type { PushMessageData } from '@utalk/shared';

// Un aviso para un celular.
export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data: PushMessageData;
}

// Puerto del envío: el service manda avisos sin saber que abajo está el
// servicio de push de Expo.
export interface PushSender {
  // Devuelve los tokens que ya no sirven (la app se desinstaló): hay que
  // borrarlos para no volver a intentar.
  send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }>;
}

export const PUSH_SENDER = Symbol('PUSH_SENDER');
