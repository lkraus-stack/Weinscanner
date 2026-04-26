import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HistoryItemRecord, WineColor } from '@/hooks/useHistory';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const COLOR_LABELS: Record<WineColor, string> = {
  rose: 'Rosé',
  rot: 'Rot',
  schaum: 'Schaum',
  suess: 'Süß',
  weiss: 'Weiß',
};

const COLOR_SWATCH_STYLES = StyleSheet.create({
  rose: {
    backgroundColor: colors.wineRose,
  },
  rot: {
    backgroundColor: colors.wineRed,
  },
  schaum: {
    backgroundColor: colors.wineSparkling,
  },
  suess: {
    backgroundColor: colors.warning,
  },
  unknown: {
    backgroundColor: colors.border,
  },
  weiss: {
    backgroundColor: colors.wineWhite,
  },
});

type Props = {
  item: HistoryItemRecord;
  onPress: (item: HistoryItemRecord) => void;
  onRate: (item: HistoryItemRecord) => void;
};

function joinMeta(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(', ');
}

export const HistoryItem = memo(function HistoryItem({
  item,
  onPress,
  onRate,
}: Props) {
  const regionLine = joinMeta([item.region, item.country]);
  const colorLabel = item.wineColor ? COLOR_LABELS[item.wineColor] : 'Unklar';
  const swatchStyle = item.wineColor
    ? COLOR_SWATCH_STYLES[item.wineColor]
    : COLOR_SWATCH_STYLES.unknown;
  const hasRating = typeof item.ratingStars === 'number';

  return (
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
            {item.producer} {item.wineName}
          </Text>
          <Text style={styles.year}>{item.vintageYear}</Text>
        </View>

        {regionLine ? (
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
            <Text style={styles.colorLabel}>{colorLabel}</Text>
          </View>
          {!hasRating ? (
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
  );
});

const styles = StyleSheet.create({
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
