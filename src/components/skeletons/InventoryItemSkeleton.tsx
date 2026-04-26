import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';

import { SkeletonBox } from './SkeletonBox';

export function InventoryItemSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View pointerEvents="none" style={styles.card}>
      <SkeletonBox borderRadius={radii.sm} height={80} width={80} />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <SkeletonBox height={18} width="86%" />
            <SkeletonBox height={14} width={64} />
          </View>
          <SkeletonBox borderRadius={radii.pill} height={28} width={34} />
        </View>

        <View style={styles.badgeRow}>
          <SkeletonBox borderRadius={radii.pill} height={28} width={86} />
          <SkeletonBox height={13} width="48%" />
        </View>

        <SkeletonBox height={14} width="78%" />
        <SkeletonBox height={14} width="62%" />
        <SkeletonBox borderRadius={radii.pill} height={34} width={136} />
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.screenX,
    padding: spacing.md,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  });
}
