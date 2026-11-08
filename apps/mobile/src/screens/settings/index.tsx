import { USERNAME_CHANGE_COOLDOWN_DAYS } from '@utalk/shared';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon, IconName } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useUpdateMyProfile } from '@/hooks/mutations';
import { useMyProfile } from '@/hooks/queries';
import { useSession } from '@/hooks/useSession';
import { ThemePreference, useThemePreference } from '@/hooks/useThemePreference';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: 'system', label: 'Según el sistema', icon: 'themeSystem' },
  { value: 'light', label: 'Claro', icon: 'themeLight' },
  { value: 'dark', label: 'Oscuro', icon: 'themeDark' },
];

// Ajustes (desde el ⚙️ de tu perfil): tu apodo, la privacidad, tu cuenta, el
// tema y cerrar sesión. Cambiar la contraseña, el teléfono, los avisos y
// eliminar la cuenta todavía no existen en el backend.
export function SettingsScreen() {
  const theme = useTheme();
  const me = useMyProfile();
  const session = useSession();
  const updateProfile = useUpdateMyProfile();
  const { preference, setPreference } = useThemePreference();
  const [signingOut, setSigningOut] = useState(false);
  const email = session?.user.email;
  const nextChange = me.data ? nextUsernameChange(me.data.usernameChangedAt) : null;

  // La app vuelve sola a la bienvenida al perder la sesión (rutas
  // protegidas en app/_layout.tsx).
  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Section title="TU APODO">
            <Row
              icon="at"
              title={me.data ? `u/${me.data.username}` : '…'}
              subtitle={
                nextChange
                  ? `Podrás cambiarlo de nuevo el ${formatDate(nextChange)}`
                  : `Se puede cambiar una vez cada ${USERNAME_CHANGE_COOLDOWN_DAYS} días`
              }
              right={
                me.data && !nextChange ? (
                  <Pressable accessibilityRole="button" onPress={() => router.push('/change-username')} hitSlop={8}>
                    <ThemedText type="smallBold" themeColor="primary">
                      Cambiar
                    </ThemedText>
                  </Pressable>
                ) : undefined
              }
            />
          </Section>
          <Hint>
            Evita tu nombre, tu carrera y tu semestre juntos: eso te vuelve fácil de reconocer. Al
            cambiarlo, tus publicaciones viejas pasan al apodo nuevo.
          </Hint>

          <Section title="PRIVACIDAD">
            <Row
              icon="lock"
              title="Perfil privado"
              subtitle="Los demás no ven tus publicaciones, comentarios ni contadores en tu perfil"
              right={
                <Switch
                  value={me.data?.isPrivate ?? false}
                  disabled={!me.data || updateProfile.isPending}
                  onValueChange={(isPrivate) => updateProfile.mutate({ isPrivate })}
                  trackColor={{ true: theme.primary }}
                />
              }
            />
          </Section>
          <Hint>
            Lo que publicas se sigue viendo en cada comunidad: privado esconde la lista en tu perfil, no
            tus publicaciones.
          </Hint>

          <Section title="CUENTA">
            <Row
              icon="shield"
              title="Correo"
              subtitle={email ? maskEmail(email) : '…'}
              right={
                <ThemedText type="small" themeColor="textSecondary">
                  Fijo
                </ThemedText>
              }
            />
          </Section>
          <Hint>
            El correo no se cambia: es lo que prueba que estudias ahí y lo que te da acceso al panel de
            tu universidad. Nunca se le muestra a nadie.
          </Hint>

          <Section title="APARIENCIA">
            {THEME_OPTIONS.map((option, index) => {
              const selected = option.value === preference;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setPreference(option.value)}
                  style={({ pressed }) => [
                    index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <Row
                    icon={option.icon}
                    title={option.label}
                    right={selected ? <Icon name="check" size={20} color="primary" /> : undefined}
                  />
                </Pressable>
              );
            })}
          </Section>
          <Hint>El tema se guarda en este dispositivo.</Hint>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Button title="Cerrar sesión" variant="ghost" onPress={() => void signOut()} loading={signingOut} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
            UTalk {Constants.expoConfig?.version ?? ''}
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Cuándo se puede volver a cambiar el apodo, o null si ya se puede (la regla
// la aplica el backend; esto es solo para mostrarla).
function nextUsernameChange(changedAt: string | null): Date | null {
  if (!changedAt) return null;
  const next = new Date(new Date(changedAt).getTime() + USERNAME_CHANGE_COOLDOWN_DAYS * DAY_MS);
  return next > new Date() ? next : null;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

// "juan.perez@correounivalle.edu.co" → "j****@correounivalle.edu.co": se
// reconoce cuál es sin mostrarlo entero (por si alguien mira la pantalla).
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  return `${user?.charAt(0) ?? ''}****@${domain ?? ''}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <View style={[styles.group, { borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

type RowProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

function Row({ icon, title, subtitle, right }: RowProps) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={20} color="textSecondary" />
      <View style={styles.rowText}>
        <ThemedText>{title}</ThemedText>
        {subtitle && (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        )}
      </View>
      {right}
    </View>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
      {children}
    </ThemedText>
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
  section: {
    marginTop: Spacing.three,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  group: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  hint: {
    marginTop: Spacing.two,
  },
  footer: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  version: {
    textAlign: 'center',
  },
});
