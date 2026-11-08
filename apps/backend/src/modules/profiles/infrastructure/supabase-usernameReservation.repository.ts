import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import type {
  UsernameReservation,
  UsernameReservationRepository,
} from '../domain/usernameReservation.repository.js';

interface ReservationRow {
  username: string;
  user_id: string;
  reserved_until: string;
}

@Injectable()
export class SupabaseUsernameReservationRepository implements UsernameReservationRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findActive(username: string, now: Date): Promise<UsernameReservation | null> {
    const { data, error } = await this.supabase.client
      .from('reserved_usernames')
      .select()
      .eq('username', username)
      .gt('reserved_until', now.toISOString())
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as ReservationRow;
    return { username: row.username, userId: row.user_id, until: new Date(row.reserved_until) };
  }

  async reserve(reservation: UsernameReservation): Promise<void> {
    const { error } = await this.supabase.client.from('reserved_usernames').upsert({
      username: reservation.username,
      user_id: reservation.userId,
      reserved_until: reservation.until.toISOString(),
    });

    if (error) throw new Error(error.message);
  }
}
