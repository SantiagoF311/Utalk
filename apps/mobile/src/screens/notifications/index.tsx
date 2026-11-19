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

// Notificaciones (desde la campana de Inicio): por ahora, publicaciones
// nuevas en comunidades a las que te uniste. Tocar una la marca como leída
// y abre la publicación.
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
      description="Únete a comunidades y te avisamos cuando alguien publique."
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

function NotificationRow({ notification }: { notification: NotificationView }) {
  const theme = useTheme();
  const unread = notification.readAt === null;

  const open = () => {
    markNotificationRead(notification);
    router.push({ pathname: '/post/[postId]', params: { postId: notification.post.id } });
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${unread ? 'Sin leer. ' : ''}Nueva publicación en c/${notification.community.slug}: ${notification.post.title}`}
      onPress={open}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.dot, unread && { backgroundColor: theme.primary }]} />
      <View style={styles.rowBody}>
        <ThemedText type="small" themeColor="textSecondary">
          Nueva publicación en c/{notification.community.slug} · {relativeTime(notification.createdAt)}
        </ThemedText>
        <ThemedText type={unread ? 'smallBold' : 'small'} numberOfLines={2}>
          {notification.post.title}
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
