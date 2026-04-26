import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

type Props = {
  title: string;
};

export function MonthHeader({ title }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.primaryDark,
    fontSize: typography.size.md,
    fontWeight: typography.weight.black,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  });
}
