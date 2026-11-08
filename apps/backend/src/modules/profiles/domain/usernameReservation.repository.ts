// Apodos que alguien dejó al cambiar el suyo: quedan reservados hasta
// `until` (nadie los puede tomar), para que nadie se haga pasar por quien lo
// dejó usando su apodo viejo. `userId` es de quién era.
export interface UsernameReservation {
  username: string;
  userId: string;
  until: Date;
}

export interface UsernameReservationRepository {
  // La reserva vigente (no vencida) de ese apodo, si hay.
  findActive(username: string, now: Date): Promise<UsernameReservation | null>;
  // Crea o renueva la reserva.
  reserve(reservation: UsernameReservation): Promise<void>;
}

export const USERNAME_RESERVATION_REPOSITORY = Symbol('USERNAME_RESERVATION_REPOSITORY');
