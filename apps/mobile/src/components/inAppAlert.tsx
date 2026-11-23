import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themedText';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { dismissInAppAlert, getInAppAlert, subscribeInAppAlert } from '@/lib/inAppAlerts';

// Cuánto queda a la vista antes de irse solo.
const VISIBLE_MS = 4500;

// El aviso interno (como el de WhatsApp o Instagram con la app abierta): una
// tarjeta que baja desde arriba, se va sola, y al tocarla abre lo que
// corresponde. Va encima de todas las pantallas (montado en el layout raíz).
export function InAppAlertHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const alert = useSyncExternalStore(subscribeInAppAlert, getInAppAlert, getInAppAlert);

  useEffect(() => {
    if (!alert) return;
    const timeout = setTimeout(() => dismissInAppAlert(alert.id), VISIBLE_MS);
    return () => clearTimeout(timeout);
  }, [alert]);

  if (!alert) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + Spacing.two }]}>
      <Animated.View key={alert.id} entering={FadeInUp} exiting={FadeOutUp} style={styles.wrapper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${alert.title}: ${alert.body}`}
          accessibilityLiveRegion="polite"
          onPress={() => {
            dismissInAppAlert(alert.id);
            alert.onPress();
          }}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}>
          <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
            <Icon name={alert.icon} size={18} color="primary" />
          </View>
          <View style={styles.text}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {alert.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {alert.body}
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar aviso"
            onPress={() => dismissInAppAlert(alert.id)}
            hitSlop={10}>
            <Icon name="close" size={16} color="textSecondary" />
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    zIndex: 1000,
  },
  wrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
