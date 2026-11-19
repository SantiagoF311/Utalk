import { PUSH_PREVIEW_MAX_LENGTH } from '@utalk/shared';
import type { NotifyNewMessageJob } from '@utalk/shared';

// El comienzo del mensaje para el aviso: en una sola línea y recortado.
export function messagePreview(body: string): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length <= PUSH_PREVIEW_MAX_LENGTH
    ? oneLine
    : `${oneLine.slice(0, PUSH_PREVIEW_MAX_LENGTH - 1)}…`;
}

// Qué dice el aviso de un mensaje nuevo. En una solicitud (alguien que
// todavía no aceptaste) no se muestra el texto: un desconocido no puede
// meter contenido en tu pantalla bloqueada.
export function newMessagePushContent(job: NotifyNewMessageJob): { title: string; body: string } {
  return {
    title: `u/${job.senderUsername}`,
    body: job.preview ?? 'Te mandó una solicitud de mensaje',
  };
}
