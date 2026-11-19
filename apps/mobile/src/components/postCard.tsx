import type { PostView } from '@utalk/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { CommunityAvatar } from '@/components/communityAvatar';
import { HiddenNotice, ReportedBanner } from '@/components/hiddenNotice';
import { Icon } from '@/components/icon';
import { PostActions } from '@/components/postActions';
import { PostImage } from '@/components/postImage';
import { ThemedText } from '@/components/themedText';
import { VoteBar } from '@/components/voteBar';
import { Spacing } from '@/constants/theme';
import { votePost } from '@/hooks/mutations';
import { useCommunity } from '@/hooks/queries';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { useRevealedReport } from '@/hooks/useRevealedReport';
import { useTheme } from '@/hooks/useTheme';
import { relativeTime } from '@/lib/relativeTime';

// Lo que la tarjeta necesita de la comunidad del post.
export type PostCommunity = { id: string; name: string; slug: string };

function openCommunity(communityId: string) {
  router.push({ pathname: '/community/[communityId]', params: { communityId } });
}

type PostCardProps = {
  post: PostView;
  // En el feed de un panel, donde se mezclan comunidades, la tarjeta dice de
  // cuál es (como Reddit). En el feed de una comunidad se omite, y en su
  // lugar va quién lo publicó.
  community?: PostCommunity;
  // Sin `community` a mano (ej. el perfil, que mezcla comunidades de varios
  // paneles): la tarjeta la pide para mostrar igual de cuál es.
  lookupCommunity?: boolean;
  // En el detalle del post se muestra todo el texto, sin tarjeta; en el
  // feed, recortado.
  full?: boolean;
  // Después de borrarla desde su "···" (ej. el detalle vuelve atrás).
  onDeleted?: () => void;
  // Vista previa antes de publicar: se ve igual, pero no se puede votar,
  // abrir el perfil ni usar el "···".
  readOnly?: boolean;
};

export function PostCard({
  post,
  community,
  lookupCommunity = false,
  full = false,
  onDeleted,
  readOnly = false,
}: PostCardProps) {
  const theme = useTheme();
  const openProfile = useOpenProfile();
  const [revealed, setRevealed] = useRevealedReport(post.id);

  // Lo reportaste: queda oculto para ti hasta que toques "Ver igual" (y se
  // puede volver a ocultar desde la franja de arriba).
  if (post.reportedByMe && !revealed) {
    return (
      <HiddenNotice
        title="Publicación oculta"
        description="La reportaste. Un moderador la va a revisar."
        onReveal={() => setRevealed(true)}
        bordered={!full}
      />
    );
  }

  return (
    <View
      style={[
        styles.card,
        !full && [styles.bordered, { borderColor: theme.border, backgroundColor: theme.background }],
      ]}>
      {post.reportedByMe && (
        <ReportedBanner label="Reportaste esta publicación" onHide={() => setRevealed(false)} />
      )}
      {full ? (
        <DetailMeta post={post} />
      ) : community ? (
        <CommunityMeta community={community} createdAt={post.createdAt} readOnly={readOnly} />
      ) : lookupCommunity ? (
        <LookupCommunityMeta post={post} />
      ) : (
        // Feed de una comunidad: quién lo publicó y hace cuánto.
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.metaText}>
          {/* Tocar el apodo abre su perfil (gana sobre el toque de la tarjeta). */}
          <ThemedText
            type="smallBold"
            themeColor="text"
            style={styles.metaText}
            onPress={readOnly ? undefined : () => openProfile(post.author.id)}
            accessibilityRole="link">
            u/{post.author.username}
          </ThemedText>
          {` · ${relativeTime(post.createdAt)}`}
        </ThemedText>
      )}

      <ThemedText style={[styles.title, full && styles.titleFull]} numberOfLines={full ? undefined : 3}>
        {post.title}
      </ThemedText>
      {post.imageUrl && <PostImage uri={post.imageUrl} full={full} />}
      <ThemedText
        type={full ? 'default' : 'small'}
        themeColor={full ? 'text' : 'textSecondary'}
        numberOfLines={full ? undefined : 3}>
        {post.body}
      </ThemedText>

      <View style={styles.footer}>
        <VoteBar
          score={post.score}
          myVote={post.myVote}
          onVote={(pressed) => {
            if (readOnly) return;
            votePost(post, pressed);
          }}
        />
        <View style={styles.comments}>
          <Icon name="comment" size={14} color="textSecondary" />
          <ThemedText type="small" themeColor="textSecondary">
            {post.commentCount}
          </ThemedText>
        </View>
        <View style={styles.actions}>
          {!readOnly && <PostActions post={post} onDeleted={onDeleted} />}
        </View>
      </View>
    </View>
  );
}

type CommunityMetaProps = { community: PostCommunity; createdAt: string; readOnly?: boolean };

// Cabecera de la tarjeta cuando se mezclan comunidades: avatar, c/<comunidad>
// y hace cuánto (tocar la comunidad la abre; gana sobre el toque de la
// tarjeta).
function CommunityMeta({ community, createdAt, readOnly = false }: CommunityMetaProps) {
  return (
    <View style={styles.meta}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Abrir c/${community.slug}`}
        disabled={readOnly}
        onPress={() => openCommunity(community.id)}
        hitSlop={4}>
        <CommunityAvatar name={community.name} size={22} />
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.metaText}>
        <ThemedText
          type="smallBold"
          themeColor="text"
          style={styles.metaText}
          onPress={readOnly ? undefined : () => openCommunity(community.id)}
          accessibilityRole="link">
          c/{community.slug}
        </ThemedText>
        {` · ${relativeTime(createdAt)}`}
      </ThemedText>
    </View>
  );
}

// Igual, pero pidiendo la comunidad (en un perfil los posts son de
// comunidades y paneles distintos, y no hay una lista a mano). Mientras
// llega, va solo la fecha.
function LookupCommunityMeta({ post }: { post: PostView }) {
  const community = useCommunity(post.communityId);
  if (!community.data) {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
        {relativeTime(post.createdAt)}
      </ThemedText>
    );
  }
  const { id, name, slug } = community.data;
  return <CommunityMeta community={{ id, name, slug }} createdAt={post.createdAt} />;
}

// Cabecera del post en su detalle, como en Reddit: la comunidad arriba (con
// su avatar; tocarla la abre) y debajo quién lo publicó, de qué universidad
// y cuándo. La comunidad se pide aparte (el post solo trae su id); mientras
// llega, va solo la línea del autor.
function DetailMeta({ post }: { post: PostView }) {
  const openProfile = useOpenProfile();
  const community = useCommunity(post.communityId);

  return (
    <View style={styles.detailMeta}>
      {community.data && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Abrir c/${community.data.slug}`}
          onPress={() => openCommunity(post.communityId)}
          hitSlop={4}>
          <CommunityAvatar name={community.data.name} size={36} />
        </Pressable>
      )}
      <View style={styles.detailMetaText}>
        {community.data && (
          <ThemedText
            type="smallBold"
            accessibilityRole="link"
            onPress={() => openCommunity(post.communityId)}>
            c/{community.data.slug}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          <ThemedText
            type="small"
            themeColor="primary"
            accessibilityRole="link"
            onPress={() => openProfile(post.author.id)}>
            u/{post.author.username}
          </ThemedText>
          {` · ${post.author.university.name} · ${relativeTime(post.createdAt)}`}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  detailMetaText: {
    flex: 1,
    gap: Spacing.half,
  },
  card: {
    gap: Spacing.two,
  },
  bordered: {
    padding: Spacing.two,
    borderRadius: 14,
    borderWidth: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  metaText: {
    fontSize: 13,
    flexShrink: 1,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 700,
  },
  titleFull: {
    fontSize: 20,
    lineHeight: 26,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  comments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  actions: {
    marginLeft: 'auto',
  },
});
