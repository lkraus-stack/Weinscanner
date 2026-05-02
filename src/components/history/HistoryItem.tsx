import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { HistoryItemRecord, WineColor } from '@/hooks/useHistory';
import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

const COLOR_LABELS: Record<WineColor, string> = {
  rose: 'Rosé',
  rot: 'Rot',
  schaum: 'Schaum',
  suess: 'Süß',
  weiss: 'Weiß',
};

type Props = {
  animateEntry?: boolean;
  animationIndex?: number;
  item: HistoryItemRecord;
  onPress: (item: HistoryItemRecord) => void;
  onRate: (item: HistoryItemRecord) => void;
};

function joinMeta(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(', ');
}

function getSwatchColor(colors: ThemeColors, wineColor?: WineColor | null) {
  switch (wineColor) {
    case 'rose':
      return colors.wineRose;
    case 'rot':
      return colors.wineRed;
    case 'schaum':
      return colors.wineSparkling;
    case 'suess':
      return colors.warning;
    case 'weiss':
      return colors.wineWhite;
    default:
      return colors.border;
  }
}

export const HistoryItem = memo(function HistoryItem({
  animateEntry = false,
  animationIndex = 0,
  item,
  onPress,
  onRate,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const regionLine = joinMeta([item.region, item.country]);
  const colorLabel = item.wineColor ? COLOR_LABELS[item.wineColor] : 'Unklar';
  const swatchStyle = { backgroundColor: getSwatchColor(colors, item.wineColor) };
  const hasRating = typeof item.ratingStars === 'number';
  const title = item.isDraft
    ? 'Scan zu prüfen'
    : [item.producer, item.wineName].filter(Boolean).join(' ');
  const yearLabel = item.vintageYear ? String(item.vintageYear) : 'Offen';
  const entering = animateEntry
    ? FadeIn.delay(Math.min(animationIndex, 8) * 50).duration(300)
    : undefined;

  return (
    <Animated.View entering={entering}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onPress(item)}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.thumbnailFrame}>
          {item.labelImageUrl ? (
            <Image
              key={item.labelImagePath ?? item.labelImageUrl}
              source={{ uri: item.labelImageUrl }}
              style={styles.thumbnail}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <Ionicons name="wine-outline" size={28} color={colors.primaryDark} />
          )}

          {hasRating ? (
            <Pressable
              accessibilityLabel="Bewertung bearbeiten"
              accessibilityRole="button"
              onPress={(event) => {
                event.stopPropagation();
                onRate(item);
              }}
              style={styles.ratingBadge}
            >
              <Text style={styles.ratingBadgeText}>★ {item.ratingStars}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {title || 'Unbekannter Wein'}
            </Text>
            <Text style={[styles.year, item.isDraft && styles.draftYear]}>
              {yearLabel}
            </Text>
          </View>

          {item.isDraft ? (
            <Text style={styles.meta} numberOfLines={1}>
              Foto gespeichert, Details fehlen noch
            </Text>
          ) : regionLine ? (
            <Text style={styles.meta} numberOfLines={1}>
              {regionLine}
            </Text>
          ) : null}

          {item.grapeVariety ? (
            <Text style={styles.meta} numberOfLines={1}>
              {item.grapeVariety}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.colorPill}>
              <View
                style={[
                  styles.swatch,
                  swatchStyle,
                ]}
              />
              <Text style={styles.colorLabel}>
                {item.isDraft ? 'Zu prüfen' : colorLabel}
              </Text>
            </View>
            {!item.isDraft && !hasRating ? (
              <Pressable
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation();
                  onRate(item);
                }}
                style={styles.rateButton}
              >
                <Ionicons
                  name="star-outline"
                  size={14}
                  color={colors.primaryDark}
                />
                <Text style={styles.rateButtonText}>Bewerten</Text>
              </Pressable>
            ) : null}
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.screenX,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  colorLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  colorPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  draftYear: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
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
  meta: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  pressed: {
    opacity: 0.78,
  },
  rateButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  rateButtonText: {
    color: colors.primaryDark,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.extraBold,
  },
  ratingBadge: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    bottom: spacing.xs,
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 46,
    paddingHorizontal: spacing.sm,
    position: 'absolute',
    right: spacing.xs,
  },
  ratingBadgeText: {
    color: colors.white,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
  },
  swatch: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 10,
    width: 10,
  },
  thumbnail: {
    height: '100%',
    width: '100%',
  },
  thumbnailFrame: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 80,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 80,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: typography.size.base,
    fontWeight: typography.weight.black,
    lineHeight: typography.lineHeight.base,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  year: {
    color: colors.primaryDark,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    lineHeight: typography.lineHeight.lg,
  },
  });
}
