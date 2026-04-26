import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';

import { SkeletonBox } from './SkeletonBox';

export function RatingItemSkeleton() {
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

        <View style={styles.starRow}>
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBox
              borderRadius={radii.pill}
              height={16}
              key={index}
              width={16}
            />
          ))}
        </View>

        <SkeletonBox height={14} width="94%" />
        <SkeletonBox height={14} width="70%" />
        <SkeletonBox height={13} width="46%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  starRow: {
    flexDirection: 'row',
    gap: spacing.xs,
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
