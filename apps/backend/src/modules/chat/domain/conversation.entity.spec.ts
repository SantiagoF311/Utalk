import { describe, expect, it } from '@jest/globals';
import { IDS, makeConversation } from '../../../testing/fixtures.js';

const STRANGER = '00000000-0000-4000-8000-0000000000b9';

describe('ConversationEntity', () => {
  it('sabe quiénes participan y quién es el otro', () => {
    const conversation = makeConversation();
    expect(conversation.hasParticipant(IDS.ana)).toBe(true);
    expect(conversation.hasParticipant(IDS.beto)).toBe(true);
    expect(conversation.hasParticipant(STRANGER)).toBe(false);
    expect(conversation.otherParticipant(IDS.ana)).toBe(IDS.beto);
    expect(conversation.otherParticipant(IDS.beto)).toBe(IDS.ana);
  });

  describe('solicitud (sin aceptar)', () => {
    const request = makeConversation({ initiatedBy: IDS.ana });

    it('para quien la mandó es request_sent y para quien la recibió request_received', () => {
      expect(request.statusFor(IDS.ana)).toBe('request_sent');
      expect(request.statusFor(IDS.beto)).toBe('request_received');
    });

    it('quien la mandó espera: no puede volver a escribir', () => {
      expect(request.canSend(IDS.ana)).toBe(false);
    });

    it('quien la recibió puede responder, y responder la acepta', () => {
      expect(request.canSend(IDS.beto)).toBe(true);
      expect(request.isAcceptedBySending(IDS.beto)).toBe(true);
    });

    it('abrirla sin responder no le muestra "Visto" a quien la mandó', () => {
      expect(request.showsReadReceiptsTo(IDS.beto)).toBe(false);
      expect(request.showsReadReceiptsTo(IDS.ana)).toBe(true);
    });
  });

  describe('aceptada', () => {
    const accepted = makeConversation({ acceptedAt: new Date() });

    it('los dos escriben libremente y nada más la acepta', () => {
      expect(accepted.statusFor(IDS.ana)).toBe('accepted');
      expect(accepted.canSend(IDS.ana)).toBe(true);
      expect(accepted.canSend(IDS.beto)).toBe(true);
      expect(accepted.isAcceptedBySending(IDS.beto)).toBe(false);
    });
  });
});
