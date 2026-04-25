import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { WineColor } from '@/hooks/useHistory';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type FilterOption = {
  label: string;
  value: WineColor | null;
};

const FILTER_OPTIONS: FilterOption[] = [
  { label: 'Alle', value: null },
  { label: 'Weiß', value: 'weiss' },
  { label: 'Rot', value: 'rot' },
  { label: 'Rosé', value: 'rose' },
  { label: 'Schaum', value: 'schaum' },
  { label: 'Süß', value: 'suess' },
];

type Props = {
  onChange: (value: WineColor | undefined) => void;
  value?: WineColor;
};

export function ColorFilter({ onChange, value }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {FILTER_OPTIONS.map((option) => {
        const isSelected = (value ?? null) === option.value;

        return (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(option.value ?? undefined)}
            style={[styles.pill, isSelected && styles.selectedPill]}
          >
            <Text
              style={[
                styles.label,
                isSelected && styles.selectedLabel,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingHorizontal: spacing.screenX,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  pill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  selectedLabel: {
    color: colors.white,
  },
  selectedPill: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
