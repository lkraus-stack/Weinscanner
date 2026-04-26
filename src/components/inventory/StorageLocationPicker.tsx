import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
};

const LOCATION_SUGGESTIONS = [
  'Keller',
  'Weinkühlschrank',
  'Vinothek',
  'Küche',
  'Esszimmer',
  'Lager',
] as const;

export function StorageLocationPicker({
  disabled = false,
  onChange,
  value,
}: Props) {
  const { colors, resolved, styles } = useStorageLocationPickerStyles();

  return (
    <View style={styles.container}>
      <TextInput
        editable={!disabled}
        onChangeText={onChange}
        placeholder="Standort eingeben"
        placeholderTextColor={colors.placeholder}
        style={styles.input}
        keyboardAppearance={resolved}
        value={value}
      />

      <View style={styles.suggestions}>
        {LOCATION_SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => onChange(suggestion)}
            style={({ pressed }) => [
              styles.suggestionPill,
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function useStorageLocationPickerStyles() {
  const { colors, resolved } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return { colors, resolved, styles };
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  disabled: {
    opacity: 0.55,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.size.base,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.78,
  },
  suggestionPill: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  });
}
