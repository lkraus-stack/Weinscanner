import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { colors } from '@/theme/colors';
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
  const scale = useRef(new Animated.Value(1)).current;

  async function handlePress() {
    if (disabled) {
      return;
    }

    await Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(scale, {
        duration: 90,
        toValue: 1.22,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        friction: 4,
        tension: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
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
      <Animated.View style={{ transform: [{ scale }] }}>
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
