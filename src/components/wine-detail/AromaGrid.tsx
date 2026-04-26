import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getAromaIcon } from '@/lib/aroma-icons';
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
        <View key={aroma} style={styles.card}>
          <Text style={styles.icon}>{getAromaIcon(aroma)}</Text>
          <Text style={styles.label} numberOfLines={2}>
            {aroma}
          </Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    width: '30.5%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  icon: {
    fontSize: 28,
    lineHeight: 34,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  });
}
