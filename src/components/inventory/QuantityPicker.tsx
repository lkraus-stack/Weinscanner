import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = {
  disabled?: boolean;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  value: number;
};

function bottleLabel(value: number) {
  return value === 1 ? '1 Flasche' : `${value} Flaschen`;
}

export function QuantityPicker({
  disabled = false,
  max = 999,
  min = 1,
  onChange,
  value,
}: Props) {
  async function step(delta: number) {
    if (disabled) {
      return;
    }

    const nextValue = Math.min(Math.max(value + delta, min), max);

    if (nextValue === value) {
      return;
    }

    await Haptics.selectionAsync();
    onChange(nextValue);
  }

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <Pressable
        accessibilityLabel="Menge verringern"
        accessibilityRole="button"
        disabled={disabled || value <= min}
        onPress={() => step(-1)}
        style={({ pressed }) => [
          styles.stepButton,
          pressed && styles.pressed,
          (disabled || value <= min) && styles.stepButtonDisabled,
        ]}
      >
        <Ionicons name="remove" size={24} color={colors.primaryDark} />
      </Pressable>

      <View style={styles.valuePanel}>
        <Text style={styles.valueText}>{bottleLabel(value)}</Text>
      </View>

      <Pressable
        accessibilityLabel="Menge erhöhen"
        accessibilityRole="button"
        disabled={disabled || value >= max}
        onPress={() => step(1)}
        style={({ pressed }) => [
          styles.stepButton,
          pressed && styles.pressed,
          (disabled || value >= max) && styles.stepButtonDisabled,
        ]}
      >
        <Ionicons name="add" size={24} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.78,
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  stepButtonDisabled: {
    opacity: 0.38,
  },
  valuePanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  valueText: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    letterSpacing: 0,
  },
});
