import { Injectable } from '@nestjs/common';
import type { NotificationType, NotifyModerationResultJob } from '@utalk/shared';
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
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
}

// Fila de `notification_list` (ver la migración `moderation_notifications`).
interface NotificationListRow extends NotificationRow {
  post_title: string;
  community_id: string;
  community_slug: string;
  community_name: string;
  report_case_number: number | null;
  report_status: 'removed' | 'dismissed' | null;
}

function toEntity(row: NotificationRow): NotificationEntity {
  return new NotificationEntity(
    row.id,
    row.user_id,
    row.type,
    row.post_id,
    row.comment_id,
    row.read_at ? new Date(row.read_at) : null,
    new Date(row.created_at),
  );
}

function toNotificationWithTarget(row: NotificationListRow): NotificationWithTarget {
  return {
    notification: toEntity(row),
    post: { id: row.post_id, title: row.post_title },
    community: { id: row.community_id, slug: row.community_slug, name: row.community_name },
    report:
      row.report_case_number !== null && row.report_status !== null
        ? { caseNumber: row.report_case_number, status: row.report_status }
        : null,
  };
}

@Injectable()
export class SupabaseNotificationRepository implements NotificationRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async createForNewPost(postId: string): Promise<string[]> {
    const { data, error } = await this.supabase.client.rpc('notify_new_post', {
      p_post_id: postId,
    });

    if (error) throw new Error(error.message);
    return (data as { id: string }[]).map((row) => row.id);
  }

  async createForModerationResult(content: NotifyModerationResultJob): Promise<string[]> {
    const { data, error } = await this.supabase.client.rpc('notify_moderation_result', {
      p_post_id: content.postId,
      p_comment_id: content.commentId,
    });

    if (error) throw new Error(error.message);
    return (data as { id: string }[]).map((row) => row.id);
  }

  async findManyWithTarget(ids: string[]): Promise<NotificationWithTarget[]> {
    if (ids.length === 0) return [];

    const { data, error } = await this.supabase.client.rpc('notifications_by_ids', {
      p_ids: ids,
    });

    if (error) throw new Error(error.message);
    return (data as NotificationListRow[]).map(toNotificationWithTarget);
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
    const { data, error } = await this.supabase.client.rpc('notification_list', {
      p_user_id: userId,
      p_limit: limit,
    });

    if (error) throw new Error(error.message);
    return (data as NotificationListRow[]).map(toNotificationWithTarget);
  }

  async countUnread(userId: string): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('unread_notification_count', {
      p_user_id: userId,
    });

    if (error) throw new Error(error.message);
    return data as number;
  }

  async markRead(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null);

    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('notifications').delete().eq('id', id);

    if (error) throw new Error(error.message);
  }

  async deleteAllByUser(userId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('notifications')
      .delete()
      .eq('user_id', userId);

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
