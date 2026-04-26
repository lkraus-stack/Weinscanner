import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';

import { SkeletonBox } from './SkeletonBox';

type Props = {
  paddingBottom: number;
};

export function WineDetailSkeleton({ paddingBottom }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom }]}
      pointerEvents="none"
      showsVerticalScrollIndicator={false}
    >
      <SkeletonBox
        borderRadius={radii.lg}
        height={280}
        style={styles.photoFrame}
      />

      <View style={styles.summary}>
        <SkeletonBox height={28} width="86%" />
        <SkeletonBox height={28} width="62%" />
        <SkeletonBox borderRadius={radii.md} height={82} width="100%" />
      </View>

      <View style={styles.section}>
        <SkeletonBox height={24} width={126} />
        <View style={styles.infoGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <View key={index} style={styles.infoCell}>
              <SkeletonBox height={13} width="48%" />
              <SkeletonBox height={18} width="78%" />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SkeletonBox height={24} width={92} />
        <View style={styles.pillRow}>
          {[84, 92, 78, 104, 88].map((width, index) => (
            <SkeletonBox
              borderRadius={radii.pill}
              height={34}
              key={index}
              width={width}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SkeletonBox height={24} width={144} />
        <View style={styles.textPanel}>
          <SkeletonBox height={16} width="96%" />
          <SkeletonBox height={16} width="92%" />
          <SkeletonBox height={16} width="88%" />
          <SkeletonBox height={16} width="70%" />
        </View>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  content: {
    gap: spacing.xxl,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
  },
  infoCell: {
    borderColor: colors.border,
    borderTopWidth: 1,
    flexBasis: '50%',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  infoGrid: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  photoFrame: {
    borderColor: colors.border,
    borderWidth: 1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  summary: {
    gap: spacing.sm,
  },
  textPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  });
}
