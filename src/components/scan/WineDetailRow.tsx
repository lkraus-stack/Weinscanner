import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

import { ConfidenceBadge } from './ConfidenceBadge';

type Props = {
  confidence?: number;
  label: string;
  value: string;
};

export function WineDetailRow({ confidence, label, value }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      {typeof confidence === 'number' ? (
        <ConfidenceBadge compact score={confidence} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowValue: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.base,
  },
});
