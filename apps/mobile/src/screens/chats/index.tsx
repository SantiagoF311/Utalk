import type { ConversationView } from '@utalk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screenHeader';
import { SegmentedControl } from '@/components/segmentedControl';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useConversations, useMyProfile } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';
import { relativeTime } from '@/lib/relativeTime';

type ChatsTab = 'chats' | 'requests';

// Chats: tus conversaciones y, aparte, las solicitudes (alguien te escribió
// y todavía no respondiste). Las que mandaste tú y esperan respuesta van en
// Chats, marcadas. Se actualiza sola por Realtime (useChatRealtime).
export function ChatsScreen() {
  const theme = useTheme();
  const conversations = useConversations();
  const [tab, setTab] = useState<ChatsTab>('chats');

  const all = conversations.data ?? [];
  const requests = all.filter((c) => c.status === 'request_received');
  const chats = all.filter((c) => c.status !== 'request_received');
  const tabs: { value: ChatsTab; label: string }[] = [
    { value: 'chats', label: 'Chats' },
    { value: 'requests', label: requests.length > 0 ? `Solicitudes (${requests.length})` : 'Solicitudes' },
  ];

  const empty = conversations.isPending ? (
    <StateMessage kind="loading" />
  ) : conversations.isError ? (
    <StateMessage
      kind="error"
      message={errorMessage(conversations.error)}
      onRetry={() => void conversations.refetch()}
    />
  ) : tab === 'chats' ? (
    <StateMessage
      kind="empty"
      title="Todavía no tienes chats"
      description="Para escribirle a alguien, toca su apodo y luego Enviar mensaje. Sigues siendo anónimo: solo ve tu apodo."
    />
  ) : (
    <StateMessage
      kind="empty"
      title="No tienes solicitudes"
      description="Cuando alguien que no conoces te escriba, su mensaje llega acá primero."
    />
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Chats" />
        <FlatList<ConversationView>
          data={tab === 'chats' ? chats : requests}
          keyExtractor={(conversation) => conversation.id}
          renderItem={({ item }) => <ConversationRow conversation={item} />}
          ListHeaderComponent={
            <View style={styles.tabs}>
              <SegmentedControl options={tabs} value={tab} onChange={setTab} />
              {tab === 'requests' && requests.length > 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  No saben si leíste su mensaje hasta que respondas. Si respondes, la conversación pasa a
                  Chats.
                </ThemedText>
              )}
            </View>
          }
          ListEmptyComponent={empty}
          refreshControl={
            <RefreshControl
              refreshing={conversations.isRefetching}
              onRefresh={() => void conversations.refetch()}
              tintColor={theme.textSecondary}
            />
          }
          contentContainerStyle={styles.content}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function ConversationRow({ conversation }: { conversation: ConversationView }) {
  const theme = useTheme();
  const me = useMyProfile();
  const { otherUser, lastMessage, unreadCount } = conversation;
  const unread = unreadCount > 0;
  const preview = lastMessage
    ? `${lastMessage.senderId === me.data?.id ? 'Tú: ' : ''}${lastMessage.body}`
    : '';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/chat/[conversationId]', params: { conversationId: conversation.id } })
      }
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
        <ThemedText type="smallBold" themeColor="primary">
          {otherUser.username.slice(0, 2).toLowerCase()}
        </ThemedText>
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <ThemedText type={unread ? 'smallBold' : 'default'} numberOfLines={1} style={styles.flex}>
            u/{otherUser.username}
          </ThemedText>
          {lastMessage && (
            <ThemedText type="small" themeColor="textSecondary">
              {relativeTime(lastMessage.createdAt)}
            </ThemedText>
          )}
        </View>
        <View style={styles.rowTop}>
          <ThemedText
            type={unread ? 'smallBold' : 'small'}
            themeColor={unread ? 'text' : 'textSecondary'}
            numberOfLines={1}
            style={styles.flex}>
            {conversation.status === 'request_sent' ? 'Esperando que acepte · ' : ''}
            {preview}
          </ThemedText>
          {unread && (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" themeColor="onPrimary" style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </ThemedText>
            </View>
          )}
        </View>
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
  tabs: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
  },
});
