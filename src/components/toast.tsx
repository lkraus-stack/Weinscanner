import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore } from '@/stores/toast-store';
import { radii, spacing } from '@/theme/spacing';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

const TOAST_DURATION_MS = 3000;

export function Toast() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const message = useToastStore((state) => state.message);
  const visible = useToastStore((state) => state.visible);
  const hideToast = useToastStore((state) => state.hideToast);
  const translateY = useSharedValue(-90);
  const opacity = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (!visible || !message) {
      translateY.value = withTiming(-90, { duration: 180 });
      opacity.value = withTiming(0, { duration: 180 });
      return;
    }

    const hideTimer = setTimeout(hideToast, TOAST_DURATION_MS);

    translateY.value = withTiming(0, { duration: 220 });
    opacity.value = withTiming(1, { duration: 220 });

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
        animatedStyle,
        {
          backgroundColor: colors.text,
          shadowColor: colors.shadow,
          top: insets.top + spacing.md,
        },
      ]}
    >
      <Text style={[styles.message, { color: colors.white }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    alignSelf: 'center',
    borderRadius: radii.md,
    left: spacing.screenX,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    position: 'absolute',
    right: spacing.screenX,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    zIndex: 50,
  },
  message: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.md,
    textAlign: 'center',
  },
});
