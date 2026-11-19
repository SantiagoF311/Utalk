import { Injectable } from '@nestjs/common';
import type { NotificationType } from '@utalk/shared';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { NotificationEntity } from '../domain/notification.entity.js';
import type {
  NotificationRepository,
  NotificationWithTarget,
} from '../domain/notification.repository.js';

interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  post_id: string;
  read_at: string | null;
  created_at: string;
}

interface NotificationWithTargetRow extends NotificationRow {
  post: {
    id: string;
    title: string;
    community: { id: string; slug: string; name: string };
  };
}

function toEntity(row: NotificationRow): NotificationEntity {
  return new NotificationEntity(
    row.id,
    row.user_id,
    row.type,
    row.post_id,
    row.read_at ? new Date(row.read_at) : null,
    new Date(row.created_at),
  );
}

@Injectable()
export class SupabaseNotificationRepository implements NotificationRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async createForNewPost(postId: string): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('notify_new_post', {
      p_post_id: postId,
    });

    if (error) throw new Error(error.message);
    return data as number;
  }

  async findById(id: string): Promise<NotificationEntity | null> {
    const { data, error } = await this.supabase.client
      .from('notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEntity(data as NotificationRow) : null;
  }

  async findLatestByUser(userId: string, limit: number): Promise<NotificationWithTarget[]> {
    // !inner: sin el post (eliminado por moderación) no hay notificación que mostrar.
    const { data, error } = await this.supabase.client
      .from('notifications')
      .select(
        '*, post:posts!inner(id, title, removed_at, community:communities!inner(id, slug, name))',
      )
      .eq('user_id', userId)
      .is('post.removed_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data as NotificationWithTargetRow[]).map((row) => ({
      notification: toEntity(row),
      post: { id: row.post.id, title: row.post.title },
      community: row.post.community,
    }));
  }

  async countUnread(userId: string): Promise<number> {
    const { count, error } = await this.supabase.client
      .from('notifications')
      .select('id, post:posts!inner(removed_at)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
      .is('post.removed_at', null);

    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async markRead(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null);

    if (error) throw new Error(error.message);
  }

  async markAllRead(userId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) throw new Error(error.message);
  }
}
