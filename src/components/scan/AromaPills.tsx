import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = {
  aromas: string[];
};

export function AromaPills({ aromas }: Props) {
  const { styles } = useAromaPillsStyles();

  if (aromas.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      {aromas.map((aroma) => (
        <View key={aroma} style={styles.pill}>
          <Text style={styles.pillText}>{aroma}</Text>
        </View>
      ))}
    </View>
  );
}

function useAromaPillsStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return { styles };
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  pill: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
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
