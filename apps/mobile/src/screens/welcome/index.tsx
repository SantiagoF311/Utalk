import { Link, router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon, IconName } from '@/components/icon';
import { Logo } from '@/components/logo';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

const POINTS: { icon: IconName; title: string; description: string }[] = [
  {
    icon: 'university',
    title: 'Dos paneles',
    description:
      'El de tu universidad, donde publican solo sus estudiantes, y el general, donde se cruzan todas.',
  },
  {
    icon: 'at',
    title: 'Un apodo, siempre el mismo',
    description:
      'Te acompaña en publicaciones y comentarios. Así se construye reputación sin dar tu nombre.',
  },
  {
    icon: 'shield',
    title: 'Anónimo, no invisible',
    description:
      'Tu cuenta está verificada por correo. Si hay amenazas o acoso, la moderación puede saber quién escribió.',
  },
];

// Primera pantalla sin sesión: qué es UTalk y qué significa el anonimato acá,
// antes de pedir datos.
export function WelcomeScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Logo size={44} />

          <ThemedText style={styles.title}>Habla sin tu nombre. No sin responsabilidad.</ThemedText>
          <ThemedText themeColor="textSecondary">
            UTalk es solo para estudiantes verificados. Nadie ve tu nombre ni tu correo: ves y te ven
            por tu apodo.
          </ThemedText>

          <View style={styles.points}>
            {POINTS.map((point) => (
              <View key={point.title} style={styles.point}>
                <Icon name={point.icon} size={20} color="primary" />
                <View style={styles.pointText}>
                  <ThemedText type="smallBold">{point.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {point.description}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Button title="Empezar" onPress={() => router.push('/register')} />
          <View style={styles.loginRow}>
            <ThemedText type="small" themeColor="textSecondary">
              ¿Ya tienes cuenta?{' '}
            </ThemedText>
            <Link href="/login">
              <ThemedText type="smallBold" themeColor="primary">
                Inicia sesión
              </ThemedText>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.four,
    paddingTop: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: 700,
    marginTop: Spacing.three,
  },
  points: {
    gap: Spacing.four,
    marginTop: Spacing.four,
  },
  point: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  pointText: {
    flex: 1,
    gap: Spacing.half,
  },
  footer: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
