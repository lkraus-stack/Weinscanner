import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getAromaVisual } from '@/lib/aroma-icons';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = {
  aromas: string[];
};

export function AromaPills({ aromas }: Props) {
  const { colors, styles } = useAromaPillsStyles();

  if (aromas.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      {aromas.map((aroma) => (
        <View key={aroma} style={styles.pill}>
          <Ionicons
            name={getAromaVisual(aroma).icon}
            size={15}
            color={colors.primaryDark}
          />
          <Text style={styles.pillText}>{aroma}</Text>
        </View>
      ))}
    </View>
  );
}

function useAromaPillsStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return { colors, styles };
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  pill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pillText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  wrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  });
}
