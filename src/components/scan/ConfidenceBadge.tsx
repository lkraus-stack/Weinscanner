import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

type ConfidenceLevel = 'high' | 'medium' | 'low';

type Props = {
  compact?: boolean;
  score: number;
};

function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

function getConfidenceLabel(score: number) {
  const level = getConfidenceLevel(score);

  if (level === 'high') return 'Sicher';
  if (level === 'medium') return 'Unsicher';
  return 'Sehr unsicher';
}

function getConfidenceIcon(level: ConfidenceLevel) {
  if (level === 'high') return 'checkmark-circle';
  if (level === 'medium') return 'help-circle';
  return 'warning';
}

export function ConfidenceBadge({ compact, score }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const level = getConfidenceLevel(score);
  const icon = getConfidenceIcon(level);

  return (
    <View
      style={[
        styles.badge,
        styles[`${level}Badge`],
        compact && styles.compactBadge,
      ]}
    >
      <Ionicons name={icon} size={compact ? 14 : 16} color={colors.white} />
      <Text style={styles.badgeText}>
        {compact ? `${Math.round(score * 100)} %` : getConfidenceLabel(score)}
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  badgeText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  compactBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  highBadge: {
    backgroundColor: colors.success,
  },
  lowBadge: {
    backgroundColor: colors.error,
  },
  mediumBadge: {
    backgroundColor: colors.warning,
  },
  });
}
