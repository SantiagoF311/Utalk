import type { ProfileComment, PublicProfile } from '@utalk/shared';
import { router } from 'expo-router';
import { ReactElement, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { BlockUserSheet } from '@/components/blockUserSheet';
import { Button } from '@/components/button';
import { FeedList } from '@/components/feedList';
import { Icon } from '@/components/icon';
import { ProfileHeader } from '@/components/profileHeader';
import { SegmentedControl } from '@/components/segmentedControl';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useToggleBlock } from '@/hooks/mutations';
import { useAuthorComments, useBlocks, useProfile } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';
import { relativeTime } from '@/lib/relativeTime';

type ProfileTab = 'posts' | 'comments';

const TABS: { value: ProfileTab; label: string }[] = [
  { value: 'posts', label: 'Publicaciones' },
  { value: 'comments', label: 'Comentarios' },
];

type ProfileViewProps = {
  userId: string;
  // El propio: lo ve todo aunque sea privado, y los textos le hablan a él.
  isOwn: boolean;
};

// Un perfil (diseño 4a), el propio o el de otro: cabecera, contadores y sus
// publicaciones y comentarios. Si es privado y no es el propio, solo la
// cabecera y el aviso.
export function ProfileView({ userId, isOwn }: ProfileViewProps) {
  const profile = useProfile(userId);
  const [tab, setTab] = useState<ProfileTab>('posts');

  if (profile.isPending) return <StateMessage kind="loading" />;
  if (profile.isError) {
    return <StateMessage kind="error" message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />;
  }

  const header = <ProfileTop profile={profile.data} isOwn={isOwn} tab={tab} onTab={setTab} />;

  // Privado y ajeno: el backend no manda contadores ni deja pedir el historial.
  if (!profile.data.stats) {
    return (
      <View style={styles.content}>
        {header}
        <StateMessage
          kind="empty"
          title="Este perfil es privado"
          description={`u/${profile.data.username} eligió no mostrar lo que publica y comenta. Lo que publica se sigue viendo en cada comunidad.`}
        />
      </View>
    );
  }

  return tab === 'posts' ? (
    <FeedList
      scope={{ authorId: userId }}
      sort="new"
      header={header}
      // Tirar hacia abajo refresca también los contadores.
      onRefresh={() => void profile.refetch()}
      empty={{
        title: isOwn ? 'Todavía no publicaste nada' : 'Todavía no publicó nada',
        description: isOwn ? 'Cuando publiques, va a aparecer acá.' : undefined,
      }}
    />
  ) : (
    <AuthorComments
      authorId={userId}
      isOwn={isOwn}
      header={header}
      onRefresh={() => void profile.refetch()}
    />
  );
}

type ProfileTopProps = {
  profile: PublicProfile;
  isOwn: boolean;
  tab: ProfileTab;
  onTab: (tab: ProfileTab) => void;
};

// Cabecera: identidad, contadores y pestañas (las pestañas solo si se puede
// ver el historial).
function ProfileTop({ profile, isOwn, tab, onTab }: ProfileTopProps) {
  const theme = useTheme();
  const { stats } = profile;

  return (
    <View style={[styles.top, { borderBottomColor: theme.border }]}>
      <ProfileHeader
        username={profile.username}
        universityName={profile.university.name}
        createdAt={profile.createdAt}
      />
      {!isOwn && <ProfileChatActions profile={profile} />}
      {isOwn && profile.isPrivate && (
        <View style={styles.privateNote}>
          <Icon name="lock" size={14} color="textSecondary" />
          <ThemedText type="small" themeColor="textSecondary">
            Tu perfil es privado: solo tú ves tu historial.
          </ThemedText>
        </View>
      )}
      {stats && (
        <>
          <View style={styles.stats}>
            <Stat value={stats.karma} label="votos" />
            <Stat value={stats.postCount} label="publicaciones" />
            <Stat value={stats.commentCount} label="comentarios" />
          </View>
          <SegmentedControl options={TABS} value={tab} onChange={onTab} />
        </>
      )}
    </View>
  );
}

// En el perfil de otro: escribirle (abre la conversación si ya hablaron) y
// bloquear o desbloquear. Un bloqueado no tiene "Enviar mensaje".
function ProfileChatActions({ profile }: { profile: PublicProfile }) {
  const blocks = useBlocks();
  const toggleBlock = useToggleBlock();
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const isBlocked = blocks.data?.some((blocked) => blocked.user.id === profile.id) ?? false;

  return (
    <View style={styles.chatActions}>
      {isBlocked ? (
        <Button
          title="Desbloquear"
          variant="ghost"
          style={styles.flex}
          loading={toggleBlock.isPending}
          onPress={() => toggleBlock.mutate({ userId: profile.id, block: false })}
        />
      ) : (
        <>
          <Button
            title="Enviar mensaje"
            style={styles.flex}
            onPress={() =>
              router.push({ pathname: '/chat/new', params: { userId: profile.id, username: profile.username } })
            }
          />
          <Button title="Bloquear" variant="ghost" onPress={() => setConfirmingBlock(true)} />
        </>
      )}
      <BlockUserSheet visible={confirmingBlock} onClose={() => setConfirmingBlock(false)} user={profile} />
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      <ThemedText style={styles.statValue}>{value.toLocaleString('es-CO')}</ThemedText> {label}
    </ThemedText>
  );
}

type AuthorCommentsProps = {
  authorId: string;
  isOwn: boolean;
  header: ReactElement;
  // Además de los comentarios, al tirar hacia abajo (la cabecera del perfil).
  onRefresh: () => void;
};

function AuthorComments({ authorId, isOwn, header, onRefresh }: AuthorCommentsProps) {
  const theme = useTheme();
  const comments = useAuthorComments(authorId);

  return (
    <FlatList<ProfileComment>
      data={comments.data ?? []}
      keyExtractor={(comment) => comment.id}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={comments.isRefetching && !comments.isFetchingNextPage}
          onRefresh={() => {
            void comments.refetch();
            onRefresh();
          }}
          tintColor={theme.textSecondary}
        />
      }
      ListHeaderComponent={<View style={styles.listHeader}>{header}</View>}
      renderItem={({ item }) => <ProfileCommentCard comment={item} />}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={
        comments.isPending ? (
          <StateMessage kind="loading" />
        ) : comments.isError ? (
          <StateMessage kind="error" message={errorMessage(comments.error)} onRetry={() => void comments.refetch()} />
        ) : (
          <StateMessage kind="empty" title={isOwn ? 'Todavía no comentaste nada' : 'Todavía no comentó nada'} />
        )
      }
      onEndReached={() => {
        if (comments.hasNextPage && !comments.isFetchingNextPage) void comments.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        comments.isFetchingNextPage ? <ActivityIndicator color={theme.textSecondary} style={styles.footer} /> : undefined
      }
    />
  );
}

// Un comentario en el perfil: de qué publicación es, el texto y sus votos.
// Tocarlo abre la publicación.
function ProfileCommentCard({ comment }: { comment: ProfileComment }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/post/[postId]', params: { postId: comment.postId } })}
      style={({ pressed }) => [
        styles.commentCard,
        { borderColor: theme.border, backgroundColor: theme.background },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        en «{comment.postTitle}» · {relativeTime(comment.createdAt)}
      </ThemedText>
      <ThemedText type="small" numberOfLines={4} style={styles.commentBody}>
        {comment.body}
      </ThemedText>
      <View style={styles.commentFooter}>
        <Icon name="upvote" size={14} color="textSecondary" />
        <ThemedText type="smallBold">{comment.score}</ThemedText>
      </View>
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  top: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chatActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  privateNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 700,
  },
  listHeader: {
    marginBottom: Spacing.three,
  },
  commentCard: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: 14,
    borderWidth: 1,
  },
  commentBody: {
    fontSize: 15,
    lineHeight: 21,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.half,
  },
  separator: {
    height: Spacing.three,
  },
  footer: {
    marginVertical: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});
