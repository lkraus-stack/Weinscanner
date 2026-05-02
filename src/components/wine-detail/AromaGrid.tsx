import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getAromaVisual } from '@/lib/aroma-icons';
import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

type Props = {
  aromas: string[];
};

export function AromaGrid({ aromas }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (aromas.length === 0) {
    return null;
  }

  return (
    <View style={styles.grid}>
      {aromas.map((aroma) => (
        <View key={aroma} style={styles.chip}>
          <View style={styles.iconShell}>
            <Ionicons
              name={getAromaVisual(aroma).icon}
              size={18}
              color={colors.primaryDark}
            />
          </View>
          <View style={styles.copy}>
            <Text style={styles.category}>{getAromaVisual(aroma).category}</Text>
            <Text style={styles.label} numberOfLines={2}>
              {aroma}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  category: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: spacing.sm,
    minHeight: 62,
    minWidth: 142,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  iconShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.extraBold,
    lineHeight: typography.lineHeight.md,
  },
  });
}
