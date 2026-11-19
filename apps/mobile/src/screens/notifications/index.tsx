import type { NotificationView } from '@utalk/shared';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { markAllNotificationsRead, markNotificationRead } from '@/hooks/mutations';
import { useNotifications } from '@/hooks/queries';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';
import { relativeTime } from '@/lib/relativeTime';

// Notificaciones (desde la campana de Inicio): publicaciones nuevas en
// comunidades a las que te uniste y avisos de moderación (en qué quedó lo
// que reportaste, o que se eliminó algo tuyo). Tocar una la marca como leída
// y abre lo que corresponda.
export function NotificationsScreen() {
  const theme = useTheme();
  const notifications = useNotifications();
  const pullToRefresh = usePullToRefresh(() => notifications.refetch());
  const hasUnread = (notifications.data ?? []).some((notification) => notification.readAt === null);

  const empty = notifications.isPending ? (
    <StateMessage kind="loading" />
  ) : notifications.isError ? (
    <StateMessage
      kind="error"
      message={errorMessage(notifications.error)}
      onRetry={() => void notifications.refetch()}
    />
  ) : (
    <StateMessage
      kind="empty"
      title="No tienes notificaciones"
      description="Únete a comunidades y te avisamos cuando alguien publique. También te avisamos en qué quedan tus reportes."
    />
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <FlatList<NotificationView>
          data={notifications.data ?? []}
          keyExtractor={(notification) => notification.id}
          renderItem={({ item }) => <NotificationRow notification={item} />}
          ListHeaderComponent={
            hasUnread ? (
              <Pressable
                accessibilityRole="button"
                onPress={markAllNotificationsRead}
                hitSlop={8}
                style={styles.markAll}>
                <ThemedText type="smallBold" themeColor="primary">
                  Marcar todas como leídas
                </ThemedText>
              </Pressable>
            ) : undefined
          }
          ListEmptyComponent={empty}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
          refreshControl={<RefreshControl {...pullToRefresh} tintColor={theme.textSecondary} />}
          contentContainerStyle={styles.content}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

// Qué dice cada aviso y adónde lleva tocarlo (null = a ningún lado: una
// publicación tuya eliminada ya no se puede abrir).
type RowContent = { kicker: string; text: string; open: (() => void) | null };

function openPost(postId: string) {
  router.push({ pathname: '/post/[postId]', params: { postId } });
}

function rowContent(notification: NotificationView): RowContent {
  const title = `«${notification.post.title}»`;

  switch (notification.type) {
    case 'new_post_in_community':
      return {
        kicker: `Nueva publicación en c/${notification.community.slug}`,
        text: notification.post.title,
        open: () => openPost(notification.post.id),
      };
    case 'report_resolved': {
      const { caseNumber, outcome } = notification.report;
      const onComment = notification.target === 'comment';
      const text =
        outcome === 'removed'
          ? onComment
            ? `Eliminamos el comentario que reportaste en ${title}.`
            : `Eliminamos la publicación ${title}.`
          : onComment
            ? `Revisamos el comentario que reportaste en ${title} y lo dejamos: no incumple las normas.`
            : `Revisamos ${title} y la dejamos: no incumple las normas.`;
      // En "Mis reportes" está el caso completo.
      return { kicker: `Tu reporte · caso #${caseNumber}`, text, open: () => router.push('/my-reports') };
    }
    case 'content_removed':
      return notification.target === 'comment'
        ? {
            kicker: 'Moderación',
            text: `Un moderador eliminó tu comentario en ${title} por no cumplir las normas.`,
            open: () => openPost(notification.post.id),
          }
        : {
            kicker: 'Moderación',
            text: `Un moderador eliminó tu publicación ${title} por no cumplir las normas.`,
            open: null,
          };
  }
}

function NotificationRow({ notification }: { notification: NotificationView }) {
  const theme = useTheme();
  const unread = notification.readAt === null;
  const { kicker, text, open } = rowContent(notification);

  return (
    <Pressable
      accessibilityRole={open ? 'link' : 'button'}
      accessibilityLabel={`${unread ? 'Sin leer. ' : ''}${kicker}: ${text}`}
      onPress={() => {
        markNotificationRead(notification);
        open?.();
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.dot, unread && { backgroundColor: theme.primary }]} />
      <View style={styles.rowBody}>
        <ThemedText type="small" themeColor="textSecondary">
          {kicker} · {relativeTime(notification.createdAt)}
        </ThemedText>
        <ThemedText type={unread ? 'smallBold' : 'small'} numberOfLines={3}>
          {text}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  markAll: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowBody: {
    flex: 1,
    gap: Spacing.half,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
});
