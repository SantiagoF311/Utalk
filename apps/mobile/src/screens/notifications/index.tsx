import { describeNotification } from '@utalk/shared';
import type { NotificationView } from '@utalk/shared';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, SheetOption } from '@/components/bottomSheet';
import { ConfirmSheet } from '@/components/confirmSheet';
import { Icon } from '@/components/icon';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  deleteAllNotifications,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/hooks/mutations';
import { useNotifications } from '@/hooks/queries';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';
import { openNotificationLink } from '@/lib/notificationLinks';
import { relativeTime } from '@/lib/relativeTime';

// Notificaciones (desde la campana de Inicio): publicaciones nuevas en
// comunidades a las que te uniste y avisos de moderación (en qué quedó lo
// que reportaste, o qué pasó con algo tuyo). Tocar una la marca como leída
// y abre lo que corresponda. El texto es el mismo del push
// (describeNotification, en @utalk/shared). Se pueden eliminar de a una
// (menú ⋯, o manteniendo presionada) o todas juntas.
export function NotificationsScreen() {
  const theme = useTheme();
  const notifications = useNotifications();
  const pullToRefresh = usePullToRefresh(() => notifications.refetch());
  const list = notifications.data ?? [];
  const hasUnread = list.some((notification) => notification.readAt === null);
  // La notificación con el menú abierto.
  const [menuFor, setMenuFor] = useState<NotificationView | null>(null);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState<string | null>(null);

  const closeDeleteAll = () => {
    setConfirmingDeleteAll(false);
    setDeleteAllError(null);
  };

  const confirmDeleteAll = async () => {
    setDeletingAll(true);
    setDeleteAllError(null);
    try {
      await deleteAllNotifications();
      setConfirmingDeleteAll(false);
    } catch (error) {
      setDeleteAllError(errorMessage(error));
    } finally {
      setDeletingAll(false);
    }
  };

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
          data={list}
          keyExtractor={(notification) => notification.id}
          renderItem={({ item }) => (
            <NotificationRow notification={item} onOpenMenu={() => setMenuFor(item)} />
          )}
          ListHeaderComponent={
            list.length > 0 ? (
              <View style={styles.header}>
                {hasUnread && (
                  <Pressable accessibilityRole="button" onPress={markAllNotificationsRead} hitSlop={8}>
                    <ThemedText type="smallBold" themeColor="primary">
                      Marcar todas como leídas
                    </ThemedText>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmingDeleteAll(true)}
                  hitSlop={8}
                  style={styles.deleteAll}>
                  <ThemedText type="smallBold" themeColor="warning">
                    Eliminar todas
                  </ThemedText>
                </Pressable>
              </View>
            ) : undefined
          }
          ListEmptyComponent={empty}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
          refreshControl={<RefreshControl {...pullToRefresh} tintColor={theme.textSecondary} />}
          contentContainerStyle={styles.content}
        />

        <BottomSheet visible={menuFor !== null} onClose={() => setMenuFor(null)}>
          {menuFor?.readAt === null && (
            <SheetOption
              icon="check"
              label="Marcar como leída"
              onPress={() => {
                markNotificationRead(menuFor);
                setMenuFor(null);
              }}
            />
          )}
          <SheetOption
            icon="trash"
            label="Eliminar notificación"
            destructive
            onPress={() => {
              if (menuFor) deleteNotification(menuFor);
              setMenuFor(null);
            }}
          />
        </BottomSheet>

        <ConfirmSheet
          visible={confirmingDeleteAll}
          onClose={closeDeleteAll}
          title="¿Eliminar todas las notificaciones?"
          description="Se borran de la lista, leídas o no. Tus publicaciones y reportes no cambian."
          confirmLabel="Sí, eliminar todas"
          cancelLabel="Volver"
          onConfirm={() => void confirmDeleteAll()}
          loading={deletingAll}
          errorMessage={deleteAllError}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

type NotificationRowProps = {
  notification: NotificationView;
  onOpenMenu: () => void;
};

function NotificationRow({ notification, onOpenMenu }: NotificationRowProps) {
  const theme = useTheme();
  const unread = notification.readAt === null;
  const { kicker, text, link } = describeNotification(notification);
  const opens = link !== 'none';

  return (
    <Pressable
      accessibilityRole={opens ? 'link' : 'button'}
      accessibilityLabel={`${unread ? 'Sin leer. ' : ''}${kicker}: ${text}`}
      onPress={() => {
        markNotificationRead(notification);
        openNotificationLink(link, notification.post.id, 'list');
      }}
      onLongPress={onOpenMenu}
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Opciones de la notificación"
        onPress={onOpenMenu}
        hitSlop={8}
        style={styles.more}>
        <Icon name="more" size={18} color="textSecondary" />
      </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  deleteAll: {
    marginLeft: 'auto',
  },
  more: {
    padding: Spacing.one,
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
