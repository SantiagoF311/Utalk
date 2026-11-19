import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { useUnreadNotificationCount } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';

// Campana de la cabecera de Inicio, con cuántas notificaciones sin leer hay.
export function NotificationBell() {
  const theme = useTheme();
  const unread = useUnreadNotificationCount().data ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
      onPress={() => router.push('/notifications')}
      hitSlop={8}>
      <View>
        <Icon name="bell" size={24} />
        {unread > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <ThemedText type="smallBold" themeColor="onPrimary" style={styles.badgeText}>
              {unread > 99 ? '99+' : unread}
            </ThemedText>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
});
