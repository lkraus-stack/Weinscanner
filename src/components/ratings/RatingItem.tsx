import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RatingListItem } from '@/hooks/useRatings';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = {
  item: RatingListItem;
  onMore: (item: RatingListItem) => void;
  onPress: (item: RatingListItem) => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'short',
});

function buildWineTitle(item: RatingListItem) {
  const wine = item.vintage?.wine;

  if (!wine) {
    return 'Wein nicht verfügbar';
  }

  return wine.producer === wine.wine_name
    ? wine.producer
    : `${wine.producer} ${wine.wine_name}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Datum offen';
  }

  return DATE_FORMATTER.format(new Date(value));
}

function getNoteExcerpt(value: string | null) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.length > 80
    ? `${trimmedValue.slice(0, 80).trim()}...`
    : trimmedValue;
}

export function RatingItem({ item, onMore, onPress }: Props) {
  const noteExcerpt = getNoteExcerpt(item.notes);
  const stars = item.stars ?? 0;
  const wine = item.vintage?.wine;
  const subline = [formatDate(item.drank_at), item.occasion]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.thumbnailFrame}>
        {item.scan?.signed_url ? (
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: item.scan.signed_url }}
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
            accessibilityLabel="Bewertungsaktionen öffnen"
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation();
              onMore(item);
            }}
            style={styles.moreButton}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.starRow}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Ionicons
              key={index}
              name={index < stars ? 'star' : 'star-outline'}
              size={16}
              color={colors.warning}
            />
          ))}
        </View>

        {noteExcerpt ? (
          <Text numberOfLines={2} style={styles.note}>
            {noteExcerpt}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <Text numberOfLines={1} style={styles.subline}>
            {subline}
          </Text>
          {wine?.region || wine?.country ? (
            <Text numberOfLines={1} style={styles.region}>
              {[wine.region, wine.country].filter(Boolean).join(', ')}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
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
  footer: {
    gap: spacing.xs,
    marginTop: spacing.xs,
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
  region: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  starRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  subline: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
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
