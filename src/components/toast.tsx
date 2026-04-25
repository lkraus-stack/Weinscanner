import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore } from '@/stores/toast-store';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const TOAST_DURATION_MS = 3000;

export function Toast() {
  const insets = useSafeAreaInsets();
  const message = useToastStore((state) => state.message);
  const visible = useToastStore((state) => state.visible);
  const hideToast = useToastStore((state) => state.hideToast);
  const translateY = useRef(new Animated.Value(-90)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !message) {
      Animated.parallel([
        Animated.timing(translateY, {
          duration: 180,
          toValue: -90,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          duration: 180,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    const hideTimer = setTimeout(hideToast, TOAST_DURATION_MS);

    Animated.parallel([
      Animated.timing(translateY, {
        duration: 220,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        duration: 220,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();

    return () => clearTimeout(hideTimer);
  }, [hideToast, message, opacity, translateY, visible]);

  if (!message) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          opacity,
          top: insets.top + spacing.md,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    alignSelf: 'center',
    backgroundColor: colors.text,
    borderRadius: radii.md,
    left: spacing.screenX,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    position: 'absolute',
    right: spacing.screenX,
    shadowColor: colors.shadow,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    zIndex: 50,
  },
  message: {
    color: colors.white,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.md,
    textAlign: 'center',
  },
});
