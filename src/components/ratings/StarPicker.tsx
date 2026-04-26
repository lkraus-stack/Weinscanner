import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/spacing';

type Props = {
  disabled?: boolean;
  onChange: (value: number) => void;
  value: number;
};

function StarButton({
  disabled,
  filled,
  onPress,
  value,
}: {
  disabled: boolean;
  filled: boolean;
  onPress: (value: number) => void;
  value: number;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  async function handlePress() {
    if (disabled) {
      return;
    }

    await Haptics.selectionAsync();
    scale.value = withSequence(
      withTiming(1.22, { duration: 90 }),
      withSpring(1, { damping: 10, stiffness: 220 })
    );
    onPress(value);
  }

  return (
    <Pressable
      accessibilityLabel={`${value} Sterne`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={handlePress}
      style={styles.starButton}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={filled ? 'star' : 'star-outline'}
          size={42}
          color={filled ? colors.warning : colors.placeholder}
        />
      </Animated.View>
    </Pressable>
  );
}

export function StarPicker({ disabled = false, onChange, value }: Props) {
  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      {[1, 2, 3, 4, 5].map((starValue) => (
        <StarButton
          key={starValue}
          disabled={disabled}
          filled={starValue <= value}
          onPress={onChange}
          value={starValue}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  starButton: {
    padding: spacing.xs,
  },
});
