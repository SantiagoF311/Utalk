import type { ConversationStatus } from '@utalk/shared';

// Una conversación 1 a 1. Mientras nadie la acepte es una solicitud: quien
// escribió primero (`initiatedBy`) espera, y la otra persona la acepta
// respondiendo.
export class ConversationEntity {
  constructor(
    readonly id: string,
    readonly userA: string,
    readonly userB: string,
    readonly initiatedBy: string,
    readonly acceptedAt: Date | null,
    readonly lastMessageAt: Date,
    readonly createdAt: Date,
  ) {}

  hasParticipant(userId: string): boolean {
    return this.userA === userId || this.userB === userId;
  }

  otherParticipant(userId: string): string {
    return this.userA === userId ? this.userB : this.userA;
  }

  isAccepted(): boolean {
    return this.acceptedAt !== null;
  }

  statusFor(userId: string): ConversationStatus {
    if (this.isAccepted()) return 'accepted';
    return this.initiatedBy === userId ? 'request_sent' : 'request_received';
  }

  // Si puede mandar un mensaje: en una aceptada, siempre; en una solicitud,
  // solo quien la recibió (y al hacerlo la acepta). Quien la mandó ya
  // escribió su primer mensaje y espera.
  canSend(userId: string): boolean {
    return this.isAccepted() || this.initiatedBy !== userId;
  }

  // Abrir una solicitud recibida no la marca como leída: quien la mandó no
  // sabe si la viste hasta que respondas (como Instagram).
  showsReadReceiptsTo(userId: string): boolean {
    return this.statusFor(userId) !== 'request_received';
  }

  // Mandar este mensaje acepta la solicitud.
  isAcceptedBySending(userId: string): boolean {
    return !this.isAccepted() && this.initiatedBy !== userId;
  }
}
