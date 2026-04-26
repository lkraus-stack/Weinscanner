import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { InventoryListItem } from '@/hooks/useInventory';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = {
  item: InventoryListItem;
  onDrink: (item: InventoryListItem) => void;
  onMore: (item: InventoryListItem) => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function bottleLabel(quantity: number) {
  return quantity === 1 ? '1 Flasche' : `${quantity} Flaschen`;
}

function buildWineTitle(item: InventoryListItem) {
  const wine = item.vintage?.wine;

  if (!wine) {
    return 'Wein nicht verfügbar';
  }

  return wine.producer === wine.wine_name
    ? wine.producer
    : `${wine.producer} ${wine.wine_name}`;
}

function formatDate(value: string | null) {
  return value ? DATE_FORMATTER.format(new Date(value)) : null;
}

function formatPrice(value: number | null) {
  if (typeof value !== 'number') {
    return null;
  }

  return `${value.toLocaleString('de-DE', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} €`;
}

function getNoteExcerpt(value: string | null) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.length > 74
    ? `${trimmedValue.slice(0, 74).trim()}...`
    : trimmedValue;
}

export const InventoryItem = memo(function InventoryItem({
  item,
  onDrink,
  onMore,
}: Props) {
  const quantity = item.quantity ?? 0;
  const isEmpty = quantity === 0;
  const noteExcerpt = getNoteExcerpt(item.notes);
  const wine = item.vintage?.wine;
  const meta = [
    item.storage_location?.trim() || 'Kein Standort',
    formatDate(item.purchased_at),
    formatPrice(item.purchase_price),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.card, isEmpty && styles.emptyCard]}>
      <View style={styles.thumbnailFrame}>
        {item.imageUrl ? (
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: item.imageUrl }}
            style={styles.thumbnail}
          />
        ) : (
          <Ionicons name="wine-outline" size={28} color={colors.primaryDark} />
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text numberOfLines={2} style={styles.title}>
              {buildWineTitle(item)}
            </Text>
            <Text style={styles.vintage}>
              {item.vintage?.vintage_year ?? 'Jahrgang offen'}
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Bestandsaktionen öffnen"
            accessibilityRole="button"
            onPress={() => onMore(item)}
            style={styles.moreButton}
          >
            <Ionicons
              color={colors.textSecondary}
              name="ellipsis-horizontal"
              size={20}
            />
          </Pressable>
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.quantityBadge, isEmpty && styles.emptyBadge]}>
            <Text
              style={[
                styles.quantityBadgeText,
                isEmpty && styles.emptyBadgeText,
              ]}
            >
              {isEmpty ? 'Leer' : bottleLabel(quantity)}
            </Text>
          </View>

          {wine?.region || wine?.country ? (
            <Text numberOfLines={1} style={styles.region}>
              {[wine.region, wine.country].filter(Boolean).join(', ')}
            </Text>
          ) : null}
        </View>

        <Text numberOfLines={1} style={styles.meta}>
          {meta}
        </Text>

        {noteExcerpt ? (
          <Text numberOfLines={2} style={styles.note}>
            {noteExcerpt}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isEmpty}
          onPress={() => onDrink(item)}
          style={({ pressed }) => [
            styles.drinkButton,
            pressed && styles.pressed,
            isEmpty && styles.drinkButtonDisabled,
          ]}
        >
          <Ionicons
            color={isEmpty ? colors.textSecondary : colors.primaryDark}
            name="remove-circle-outline"
            size={18}
          />
          <Text
            style={[
              styles.drinkButtonText,
              isEmpty && styles.drinkButtonTextDisabled,
            ]}
          >
            Eine getrunken
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
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
  drinkButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  drinkButtonDisabled: {
    opacity: 0.55,
  },
  drinkButtonText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  drinkButtonTextDisabled: {
    color: colors.textSecondary,
  },
  emptyBadge: {
    backgroundColor: colors.textSecondary,
    borderColor: colors.textSecondary,
  },
  emptyBadgeText: {
    color: colors.white,
  },
  emptyCard: {
    opacity: 0.82,
  },
  meta: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  moreButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    marginRight: -spacing.xs,
    marginTop: -spacing.xs,
    width: 34,
  },
  note: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  pressed: {
    opacity: 0.78,
  },
  quantityBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  quantityBadgeText: {
    color: colors.white,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
  },
  region: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
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
    height: 86,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 80,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.black,
    lineHeight: typography.lineHeight.base,
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
  vintage: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
});
