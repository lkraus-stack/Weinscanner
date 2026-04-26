import { useEffect } from 'react';
import {
  type DimensionValue,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/colors';
import { radii } from '@/theme/spacing';

type Props = {
  borderRadius?: number;
  height: DimensionValue;
  shimmerWidth?: number;
  style?: StyleProp<ViewStyle>;
  width?: DimensionValue;
};

export function SkeletonBox({
  borderRadius = radii.sm,
  height,
  shimmerWidth = 96,
  style,
  width = '100%',
}: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false
    );
  }, [progress]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-shimmerWidth, 360]),
      },
    ],
  }));

  return (
    <View
      accessible={false}
      style={[
        styles.box,
        {
          borderRadius,
          height,
          width,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            borderRadius,
            width: shimmerWidth,
          },
          shimmerStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.skeletonBase,
    overflow: 'hidden',
  },
  shimmer: {
    backgroundColor: colors.skeletonHighlight,
    bottom: 0,
    opacity: 0.72,
    position: 'absolute',
    top: 0,
  },
});
