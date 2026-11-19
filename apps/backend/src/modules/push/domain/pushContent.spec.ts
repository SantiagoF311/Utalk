import { describe, expect, it } from '@jest/globals';
import { PUSH_PREVIEW_MAX_LENGTH } from '@utalk/shared';
import { messagePreview, newMessagePushContent } from './pushContent.js';

const CONVERSATION = '00000000-0000-4000-8000-000000000101';
const RECIPIENT = '00000000-0000-4000-8000-0000000000b2';

describe('messagePreview', () => {
  it('deja un mensaje corto tal cual', () => {
    expect(messagePreview('hola, ¿vienes al parcial?')).toBe('hola, ¿vienes al parcial?');
  });

  it('lo pasa a una sola línea', () => {
    expect(messagePreview('  hola\n\n  qué tal  ')).toBe('hola qué tal');
  });

  it('recorta uno largo con "…" sin pasarse del máximo', () => {
    const preview = messagePreview('a'.repeat(500));

    expect(preview).toHaveLength(PUSH_PREVIEW_MAX_LENGTH);
    expect(preview.endsWith('…')).toBe(true);
  });
});

describe('newMessagePushContent', () => {
  const job = { recipientId: RECIPIENT, conversationId: CONVERSATION, senderUsername: 'ana' };

  it('en una conversación aceptada muestra quién escribió y el comienzo del mensaje', () => {
    expect(newMessagePushContent({ ...job, preview: 'hola' })).toEqual({
      title: 'u/ana',
      body: 'hola',
    });
  });

  it('en una solicitud no muestra el texto', () => {
    expect(newMessagePushContent({ ...job, preview: null })).toEqual({
      title: 'u/ana',
      body: 'Te mandó una solicitud de mensaje',
    });
  });
});
