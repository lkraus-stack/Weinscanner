import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import type { WineProfile } from '@/types/restaurant';

type Props = {
  profile?: WineProfile | null;
};

export function WineIndicatorBadge({ profile }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!profile || profile.wineScore === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.scorePill}>
        {Array.from({ length: profile.wineScore }).map((_, index) => (
          <Ionicons
            color={colors.primaryDark}
            key={`wine-score-${index}`}
            name="wine-outline"
            size={13}
          />
        ))}
      </View>
      {profile.badges.map((badge) => (
        <View key={badge} style={styles.badge}>
          <Text numberOfLines={1} style={styles.badgeText}>
            {badge}
          </Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    badge: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 24,
      paddingHorizontal: spacing.sm,
    },
    badgeText: {
      color: colors.primaryDark,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.extraBold,
    },
    scorePill: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 2,
      minHeight: 24,
      paddingHorizontal: spacing.sm,
    },
    wrapper: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
  });
}
