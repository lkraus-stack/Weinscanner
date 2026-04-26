import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';

import { SkeletonBox } from './SkeletonBox';

export function HistoryItemSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View pointerEvents="none" style={styles.card}>
      <SkeletonBox borderRadius={radii.sm} height={80} width={80} />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <SkeletonBox height={18} width="82%" />
            <SkeletonBox height={18} width="64%" />
          </View>
          <SkeletonBox borderRadius={radii.pill} height={26} width={56} />
        </View>

        <SkeletonBox height={14} width="72%" />
        <SkeletonBox height={14} width="54%" />

        <View style={styles.footer}>
          <SkeletonBox borderRadius={radii.pill} height={28} width={86} />
          <SkeletonBox borderRadius={radii.pill} height={28} width={92} />
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
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
