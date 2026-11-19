import { POST_IMAGE_MAX_BYTES, POST_IMAGE_TYPES } from '@utalk/shared';
import type { CommunityView, PostView } from '@utalk/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottomSheet';
import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { Icon } from '@/components/icon';
import { PostCard } from '@/components/postCard';
import { SegmentedControl } from '@/components/segmentedControl';
import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCreatePost } from '@/hooks/mutations';
import { useCommunities, useCommunity, useMyProfile } from '@/hooks/queries';
import { useMyPanels } from '@/hooks/useMyPanels';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';

const TITLE_MAX_LENGTH = 300;

// Lo que el backend va a rechazar, avisado antes de mandar nada. El tamaño
// y el tipo pueden no venir (depende de la plataforma): ahí decide el backend.
function imageProblem(image: ImagePicker.ImagePickerAsset | null): string | null {
  if (!image) return null;
  if (image.fileSize !== undefined && image.fileSize > POST_IMAGE_MAX_BYTES) {
    return 'La imagen pesa demasiado (máximo 5 MB). Elige otra.';
  }
  if (image.mimeType && !(POST_IMAGE_TYPES as readonly string[]).includes(image.mimeType)) {
    return 'La imagen tiene que ser JPG, PNG o WebP.';
  }
  return null;
}

// Nueva publicación (diseño 2a/2b): dónde se ve (tu panel o el general, y la
// comunidad), título y texto. "Publicar" abre la vista previa; desde ahí se
// publica de verdad. Si se abrió desde una comunidad, viene elegida.
// `title`: título ya escrito (ej. "Publicar esta pregunta" desde una búsqueda
// sin resultados).
export function ComposeScreen({
  communityId: initialCommunityId,
  title: initialTitle,
}: {
  communityId?: string;
  title?: string;
}) {
  const theme = useTheme();
  const me = useMyProfile();
  const { publishable, status, error, retry } = useMyPanels();
  const initialCommunity = useCommunity(initialCommunityId ?? '', { enabled: !!initialCommunityId });
  const createPost = useCreatePost();

  const [chosenPanelId, setChosenPanelId] = useState<string | null>(null);
  const [chosenCommunityId, setChosenCommunityId] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTitle ?? '');
  const [body, setBody] = useState('');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const imageWarning = imageProblem(image);

  // La comunidad de la que se vino cuenta solo si es de un panel donde se
  // puede publicar.
  const fromCommunity = publishable.some((panel) => panel.id === initialCommunity.data?.panelId)
    ? initialCommunity.data
    : undefined;
  const panel =
    publishable.find((p) => p.id === (chosenPanelId ?? fromCommunity?.panelId)) ?? publishable[0];
  const communities = useCommunities(panel?.id ?? '');
  const community = communities.data?.find(
    (c) => c.id === (chosenCommunityId ?? (fromCommunity?.panelId === panel?.id ? fromCommunity?.id : null)),
  );

  const canPublish =
    !!community && title.trim().length > 0 && body.trim().length > 0 && !imageWarning;

  // La galería del sistema: no necesita pedir permiso para elegir una foto.
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setImage(result.assets[0] ?? null);
  };

  if (status === 'pending') {
    return (
      <ThemedView style={styles.container}>
        <StateMessage kind="loading" />
      </ThemedView>
    );
  }
  if (status === 'error' || !panel) {
    return (
      <ThemedView style={styles.container}>
        <StateMessage
          kind="error"
          message={status === 'error' ? errorMessage(error) : 'Todavía no hay paneles donde publicar.'}
          onRetry={retry}
        />
      </ThemedView>
    );
  }

  const publish = () => {
    if (!community) return;
    createPost.mutate(
      { communityId: community.id, title: title.trim(), body: body.trim(), image },
      {
        onSuccess: (post) => {
          setPreviewing(false);
          // Se cierra el modal y se abre la publicación recién hecha.
          router.replace({ pathname: '/post/[postId]', params: { postId: post.id } });
        },
      },
    );
  };

  const preview: PostView | null =
    community && me.data
      ? {
          id: 'preview',
          communityId: community.id,
          title: title.trim(),
          body: body.trim(),
          score: 0,
          commentCount: 0,
          createdAt: new Date().toISOString(),
          myVote: null,
          reportedByMe: false,
          // La foto local: todavía no está subida.
          imageUrl: image?.uri ?? null,
          author: {
            id: me.data.id,
            username: me.data.username,
            university: { id: me.data.universityId, slug: '', name: publishable[0]?.name ?? '' },
          },
        }
      : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => router.back()} hitSlop={8}>
            <Icon name="close" />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Nueva publicación</ThemedText>
          <Button
            title="Publicar"
            disabled={!canPublish}
            onPress={() => {
              createPost.reset();
              setPreviewing(true);
            }}
            style={styles.headerButton}
          />
        </View>

        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              ¿DÓNDE SE VE?
            </ThemedText>
            {publishable.length > 1 && (
              <SegmentedControl
                options={publishable.map((p) => ({ value: p.id, label: p.universityId === null ? 'General' : p.name }))}
                value={panel.id}
                onChange={(panelId) => {
                  setChosenPanelId(panelId);
                  setChosenCommunityId(null);
                }}
              />
            )}
            <ThemedText type="small" themeColor="textSecondary">
              {panel.universityId === null
                ? 'En el panel general, donde se cruzan todas las universidades.'
                : `En el panel de ${panel.name}. Publican solo sus estudiantes.`}
            </ThemedText>

            <CommunityPicker
              communities={communities.data}
              loading={communities.isPending}
              selectedId={community?.id}
              onSelect={setChosenCommunityId}
            />

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Título"
              placeholderTextColor={theme.textSecondary}
              maxLength={TITLE_MAX_LENGTH}
              multiline
              style={[styles.titleInput, { color: theme.text }]}
            />
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="¿Qué quieres contar?"
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[styles.bodyInput, { color: theme.text }]}
            />

            {image ? (
              <View style={styles.imageBox}>
                <Image
                  source={{ uri: image.uri }}
                  contentFit="cover"
                  accessible
                  accessibilityLabel="Imagen elegida"
                  style={[styles.imageThumb, { backgroundColor: theme.backgroundElement }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quitar la imagen"
                  onPress={() => setImage(null)}
                  hitSlop={8}
                  style={[styles.imageRemove, { backgroundColor: theme.background }]}>
                  <Icon name="close" size={18} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => void pickImage()}
                style={[styles.addImage, { borderColor: theme.border }]}>
                <Icon name="image" size={20} color="textSecondary" />
                <ThemedText type="small" themeColor="textSecondary">
                  Agregar imagen (opcional)
                </ThemedText>
              </Pressable>
            )}
            {imageWarning && <Callout variant="warning">{imageWarning}</Callout>}
            {image && (
              <ThemedText type="small" themeColor="textSecondary">
                Antes de subir una foto, fíjate que no se vea la cara, el nombre ni datos de nadie.
              </ThemedText>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Icon name="at" size={16} color="textSecondary" />
            <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
              Se publica como{' '}
              <ThemedText type="smallBold" themeColor="text">
                u/{me.data?.username}
              </ThemedText>
              . Tu nombre no aparece.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {title.length}/{TITLE_MAX_LENGTH}
            </ThemedText>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <BottomSheet
        visible={previewing}
        onClose={() => setPreviewing(false)}
        title="Así se va a ver"
        description={community ? `En c/${community.slug}, del panel ${panel.name}.` : undefined}>
        <View style={styles.previewBody}>
          {preview && <PostCard post={preview} community={community} readOnly />}
          <Callout>Después de publicar puedes borrarla, pero no editar el texto.</Callout>
          {createPost.isError && <Callout variant="warning">{errorMessage(createPost.error)}</Callout>}
          <Button
            title={`Publicar en ${panel.universityId === null ? 'General' : panel.name}`}
            onPress={publish}
            loading={createPost.isPending}
          />
          <Button title="Seguir editando" variant="ghost" onPress={() => setPreviewing(false)} disabled={createPost.isPending} />
        </View>
      </BottomSheet>
    </ThemedView>
  );
}

type CommunityPickerProps = {
  communities: CommunityView[] | undefined;
  loading: boolean;
  selectedId: string | undefined;
  onSelect: (communityId: string) => void;
};

function CommunityPicker({ communities, loading, selectedId, onSelect }: CommunityPickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.picker}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        COMUNIDAD
      </ThemedText>
      {loading ? (
        <ThemedText type="small" themeColor="textSecondary">
          Cargando…
        </ThemedText>
      ) : !communities || communities.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Este panel todavía no tiene comunidades.
        </ThemedText>
      ) : (
        <View style={styles.chips}>
          {communities.map((c) => {
            const selected = c.id === selectedId;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => onSelect(c.id)}
                style={[
                  styles.chip,
                  selected
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { borderColor: theme.border },
                ]}>
                <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'onPrimary' : 'text'}>
                  c/{c.slug}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  headerButton: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  picker: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
  },
  titleInput: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
    marginTop: Spacing.two,
  },
  bodyInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 160,
    textAlignVertical: 'top',
  },
  addImage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  imageBox: {
    alignSelf: 'flex-start',
  },
  imageThumb: {
    width: 160,
    height: 160,
    borderRadius: 12,
  },
  imageRemove: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    flex: 1,
  },
  previewBody: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
});
