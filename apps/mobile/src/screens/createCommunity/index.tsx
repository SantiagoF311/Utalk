import { COMMUNITY_DESCRIPTION_MAX_LENGTH } from '@utalk/shared';
import type { CommunityTopic } from '@utalk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { Icon } from '@/components/icon';
import { SegmentedControl } from '@/components/segmentedControl';
import { StateMessage } from '@/components/stateMessage';
import { TextField } from '@/components/textField';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCreateCommunity } from '@/hooks/mutations';
import { useMyPanels } from '@/hooks/useMyPanels';
import { useTheme } from '@/hooks/useTheme';
import { COMMUNITY_TOPIC_OPTIONS, slugify } from '@/lib/communityTopics';
import { errorMessage } from '@/lib/errorMessages';

const SLUG_MIN_LENGTH = 3;

// Crear una comunidad (desde el sidebar): en tu universidad o en el general,
// con nombre, c/<nombre corto>, tema y descripción. Quien la crea queda como
// moderador y miembro.
export function CreateCommunityScreen({ panelId: initialPanelId }: { panelId?: string }) {
  const theme = useTheme();
  const { publishable, status } = useMyPanels();
  const createCommunity = useCreateCommunity();
  const [chosenPanelId, setChosenPanelId] = useState<string | null>(null);
  const [name, setName] = useState('');
  // Mientras no se toque, el nombre corto sale del nombre.
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  const [topic, setTopic] = useState<CommunityTopic | null>(null);
  const [description, setDescription] = useState('');

  const panel = publishable.find((p) => p.id === (chosenPanelId ?? initialPanelId)) ?? publishable[0];
  const slug = customSlug ?? slugify(name);
  const canCreate = !!panel && name.trim().length > 0 && slug.length >= SLUG_MIN_LENGTH && topic !== null;

  if (status === 'pending' || !panel) {
    return (
      <ThemedView style={styles.container}>
        <StateMessage kind="loading" />
      </ThemedView>
    );
  }

  const create = () => {
    if (!canCreate || !topic) return;
    createCommunity.mutate(
      { panelId: panel.id, name: name.trim(), slug, topic, description: description.trim() },
      {
        onSuccess: (community) =>
          router.replace({ pathname: '/community/[communityId]', params: { communityId: community.id } }),
      },
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => router.back()} hitSlop={8}>
            <Icon name="close" />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Nueva comunidad</ThemedText>
        </View>

        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              ¿DÓNDE?
            </ThemedText>
            {publishable.length > 1 && (
              <SegmentedControl
                options={publishable.map((p) => ({ value: p.id, label: p.universityId === null ? 'General' : p.name }))}
                value={panel.id}
                onChange={setChosenPanelId}
              />
            )}

            <TextField
              label="Nombre"
              value={name}
              onChangeText={setName}
              placeholder="Cálculo II"
              maxLength={64}
            />
            <View style={styles.field}>
              <TextField
                label="Nombre corto"
                value={slug}
                onChangeText={(value) => setCustomSlug(slugify(value))}
                placeholder="calculo_ii"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={32}
              />
              <ThemedText type="small" themeColor="textSecondary">
                Se va a ver como c/{slug || '…'}. Minúsculas, números y guion bajo.
              </ThemedText>
            </View>

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              TEMA
            </ThemedText>
            <View style={styles.chips}>
              {COMMUNITY_TOPIC_OPTIONS.map((option) => {
                const selected = option.value === topic;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setTopic(option.value)}
                    style={[
                      styles.chip,
                      selected
                        ? { backgroundColor: theme.primary, borderColor: theme.primary }
                        : { borderColor: theme.border },
                    ]}>
                    <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'onPrimary' : 'text'}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              DESCRIPCIÓN (opcional)
            </ThemedText>
            <View>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="¿De qué se habla acá?"
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={COMMUNITY_DESCRIPTION_MAX_LENGTH}
                style={[styles.description, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
                {description.length} / {COMMUNITY_DESCRIPTION_MAX_LENGTH}
              </ThemedText>
            </View>

            {createCommunity.isError && <Callout variant="warning">{errorMessage(createCommunity.error)}</Callout>}
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Crear comunidad" disabled={!canCreate} loading={createCommunity.isPending} onPress={create} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Vas a quedar como moderador.
            </ThemedText>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
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
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: Spacing.two,
  },
  field: {
    gap: Spacing.one,
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
  description: {
    minHeight: 90,
    borderRadius: 12,
    padding: Spacing.three,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  counter: {
    textAlign: 'right',
    marginTop: Spacing.one,
  },
  footer: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
});
