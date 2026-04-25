import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = {
  title: string;
};

export function MonthHeader({ title }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
