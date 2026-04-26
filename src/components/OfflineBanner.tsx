import { useNetInfo } from '@react-native-community/netinfo';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const BANNER_HEIGHT = 44;

function isOffline(state: ReturnType<typeof useNetInfo>) {
  return state.isConnected === false || state.isInternetReachable === false;
}

export function OfflineBanner() {
  const netInfo = useNetInfo();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const visible = isOffline(netInfo);
  const progress = useSharedValue(0);
  const totalHeight = BANNER_HEIGHT + insets.top;

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: 240 });
  }, [progress, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (progress.value - 1) * totalHeight }],
  }));

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.banner,
        {
          height: totalHeight,
          paddingTop: insets.top,
        },
        animatedStyle,
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={colors.white} />
      <Text style={styles.text}>
        Du bist offline. Einige Funktionen sind nicht verfügbar.
      </Text>
    </Animated.View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      alignItems: 'center',
      backgroundColor: colors.error,
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'center',
      left: 0,
      paddingHorizontal: spacing.lg,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 50,
    },
    text: {
      color: colors.white,
      flexShrink: 1,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.extraBold,
      lineHeight: typography.lineHeight.sm,
      textAlign: 'center',
    },
  });
}
