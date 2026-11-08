import { REPORT_DETAIL_MAX_LENGTH } from '@utalk/shared';
import type { ReportCategory } from '@utalk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { Icon, IconName } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { ReportTarget, useReport } from '@/hooks/mutations';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: 'exposes_person', label: 'Expone a una persona' },
  { value: 'threat', label: 'Amenaza o incita a la violencia' },
  { value: 'harassment', label: 'Acoso contra alguien' },
  { value: 'spam', label: 'Spam o cuenta falsa' },
  { value: 'other', label: 'Otra cosa' },
];

type ReportScreenProps = {
  target: ReportTarget;
  // Apodo del autor, para el subtítulo ("De u/x").
  authorUsername?: string;
};

// Reportar una publicación o un comentario (diseño 2e) y la confirmación
// (2f). Quien escribió no sabe quién lo reportó.
export function ReportScreen({ target, authorUsername }: ReportScreenProps) {
  const report = useReport();
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [detail, setDetail] = useState('');
  const what = target.kind === 'post' ? 'publicación' : 'comentario';

  if (report.isSuccess) {
    return <ReportSent what={what} />;
  }

  const submit = () => {
    if (!category) return;
    report.mutate({ target, category, reason: detail.trim() });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ReportHeader />
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText style={styles.title}>
              ¿Qué pasa con {target.kind === 'post' ? 'esta publicación' : 'este comentario'}?
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {authorUsername ? `De u/${authorUsername}. ` : ''}No va a saber quién lo reportó.
            </ThemedText>

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              MOTIVO
            </ThemedText>
            <View style={styles.options}>
              {CATEGORIES.map((option) => (
                <CategoryOption
                  key={option.value}
                  label={option.label}
                  selected={option.value === category}
                  onPress={() => setCategory(option.value)}
                />
              ))}
            </View>

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              DETALLE (opcional)
            </ThemedText>
            <DetailField value={detail} onChange={setDetail} />

            {report.isError && <Callout variant="warning">{errorMessage(report.error)}</Callout>}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Enviar reporte"
              variant="strong"
              disabled={!category}
              loading={report.isPending}
              onPress={submit}
            />
            <Button title="Volver" variant="ghost" onPress={() => router.back()} disabled={report.isPending} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ReportHeader() {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => router.back()} hitSlop={8}>
        <Icon name="close" />
      </Pressable>
    </View>
  );
}

function CategoryOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.option,
        { borderColor: selected ? theme.primary : theme.border },
        selected && { borderWidth: 1.5 },
      ]}>
      <View style={[styles.radio, { borderColor: selected ? theme.primary : theme.textSecondary }]}>
        {selected && <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />}
      </View>
      <ThemedText>{label}</ThemedText>
    </Pressable>
  );
}

function DetailField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const theme = useTheme();
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Ej.: en los comentarios están diciendo el nombre completo y el salón de la persona."
        placeholderTextColor={theme.textSecondary}
        multiline
        maxLength={REPORT_DETAIL_MAX_LENGTH}
        style={[styles.detail, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />
      <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
        {value.length} / {REPORT_DETAIL_MAX_LENGTH}
      </ThemedText>
    </View>
  );
}

// Confirmación (diseño 2f). Solo dice lo que de verdad pasa: el número de
// caso y el aviso de cómo quedó llegan con la moderación.
function ReportSent({ what }: { what: 'publicación' | 'comentario' }) {
  const theme = useTheme();
  // "la publicación" / "el comentario": artículo y terminaciones según cuál.
  const a = what === 'publicación' ? 'a' : 'o';
  const items: { icon: IconName; title: string; description: string }[] = [
    {
      icon: 'hidden',
      title: `Ya no l${a} verás`,
      description: `Queda ocult${a} para ti. Puedes abrirl${a} igual desde el aviso.`,
    },
    {
      icon: 'shield',
      title: 'Nadie más sabe que fuiste tú',
      description: 'Tu reporte solo lo ve la moderación. Quien lo escribió no sabe quién reportó.',
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={[styles.content, styles.sentContent]}>
          <View style={[styles.sentIcon, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="checkCircle" size={32} color="success" />
          </View>
          <ThemedText style={[styles.title, styles.center]}>Listo, lo estamos mirando</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            Un moderador va a revisar {what === 'publicación' ? 'la publicación' : 'el comentario'}.
          </ThemedText>
          <View style={styles.sentItems}>
            {items.map((item) => (
              <View key={item.title} style={[styles.sentItem, { backgroundColor: theme.backgroundElement }]}>
                <Icon name={item.icon} size={20} color="textSecondary" />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{item.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.description}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Volver" onPress={() => router.back()} />
        </View>
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
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.four,
    paddingTop: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 700,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: Spacing.two,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detail: {
    minHeight: 100,
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
  sentContent: {
    alignItems: 'stretch',
    paddingTop: Spacing.six,
  },
  sentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  center: {
    textAlign: 'center',
  },
  sentItems: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  sentItem: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
  },
  flex: {
    flex: 1,
  },
});
