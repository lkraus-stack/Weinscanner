import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useInventory, type InventoryListItem } from '@/hooks/useInventory';
import { useRestaurantRecommendationRun } from '@/hooks/useRestaurantAi';
import { useSavedRestaurants } from '@/hooks/useSavedRestaurants';
import { trackAdoptionEvent } from '@/lib/analytics';
import { RESTAURANT_AI_OCCASION_LABELS } from '@/lib/restaurants';
import { useToastStore } from '@/stores/toast-store';
import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import type {
  RestaurantAiConfidence,
  RestaurantAiRecommendation,
  RestaurantRecord,
} from '@/types/restaurant';

function normalizeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatRating(value: number | null) {
  return value === null ? 'Neu' : value.toFixed(1).replace('.', ',');
}

function formatDistance(value: number | null) {
  if (value === null) {
    return null;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace('.', ',')} km`;
  }

  return `${value} m`;
}

function getConfidenceLabel(value: RestaurantAiConfidence) {
  switch (value) {
    case 'high':
      return 'Hohe Sicherheit';
    case 'low':
      return 'Mit Vorsicht';
    default:
      return 'Solide Empfehlung';
  }
}

function getInventoryLabel(item: InventoryListItem) {
  const wine = item.vintage?.wine;
  const year = item.vintage?.vintage_year;

  if (!wine) {
    return 'Unbekannter Wein';
  }

  return `${wine.producer} ${wine.wine_name}${year ? `, ${year}` : ''}`;
}

function RestaurantImage({
  restaurant,
  styles,
}: {
  restaurant: RestaurantRecord;
  styles: ReturnType<typeof makeStyles>;
}) {
  if (restaurant.photoUrl) {
    return (
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        source={{ uri: restaurant.photoUrl }}
        style={styles.photo}
      />
    );
  }

  return (
    <View style={styles.photoFallback}>
      <Text style={styles.photoFallbackText}>{restaurant.name.slice(0, 1)}</Text>
    </View>
  );
}

export default function RestaurantAiResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ runId?: string }>();
  const runId = normalizeParam(params.runId);
  const runQuery = useRestaurantRecommendationRun(runId);
  const inventoryQuery = useInventory({ hideEmptyInventory: true });
  const savedRestaurants = useSavedRestaurants();
  const showToast = useToastStore((state) => state.showToast);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const viewedRunIdRef = useRef<string | null>(null);
  const inventoryItems = useMemo(
    () => inventoryQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [inventoryQuery.data?.pages]
  );
  const inventoryById = useMemo(
    () => new Map(inventoryItems.map((item) => [item.id, item])),
    [inventoryItems]
  );
  const run = runQuery.data;
  const bestRecommendation = run?.recommendations[0] ?? null;
  const alternatives = run?.recommendations.slice(1, 3) ?? [];

  useEffect(() => {
    if (!run?.id || !bestRecommendation || viewedRunIdRef.current === run.id) {
      return;
    }

    viewedRunIdRef.current = run.id;
    trackAdoptionEvent('restaurant_ai_detail_viewed', {
      feature: 'discover',
    });
  }, [bestRecommendation, run?.id]);

  async function toggleSaved(restaurant: RestaurantRecord) {
    try {
      await Haptics.selectionAsync();

      if (savedRestaurants.isSaved(restaurant)) {
        await savedRestaurants.remove(restaurant);
        showToast('Restaurant entfernt');
      } else {
        await savedRestaurants.save(restaurant);
        trackAdoptionEvent('restaurant_saved', { feature: 'discover' });
        showToast('Restaurant gemerkt');
      }
    } catch {
      showToast('Restaurant konnte nicht gespeichert werden.');
    }
  }

  function openDetail(restaurant: RestaurantRecord) {
    router.push({
      pathname: '/restaurant-detail' as never,
      params: {
        provider: restaurant.provider,
        providerPlaceId: restaurant.providerPlaceId,
        restaurantId: restaurant.id,
      },
    });
  }

  async function openNavigation(restaurant: RestaurantRecord) {
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${restaurant.location.lat},${restaurant.location.lng}`;
    const url = restaurant.googleMapsUri ?? fallbackUrl;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Navigation nicht verfügbar',
        'Der Google Maps Link konnte nicht geöffnet werden.'
      );
    }
  }

  if (runQuery.isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>KI-Auswahl laden</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!run || !bestRecommendation) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyState}>
          <Ionicons color={colors.primary} name="sparkles-outline" size={34} />
          <Text style={styles.emptyTitle}>Keine KI-Auswahl gefunden</Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Zurück</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="chevron-back" size={26} />
        </Pressable>
        <Text style={styles.topBarTitle}>KI-Auswahl</Text>
        <View style={styles.iconButtonGhost} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <RestaurantImage
            restaurant={bestRecommendation.restaurant}
            styles={styles}
          />
          <View style={styles.heroOverlay}>
            <View style={styles.heroBadge}>
              <Ionicons color={colors.white} name="sparkles" size={15} />
              <Text style={styles.heroBadgeText}>
                {RESTAURANT_AI_OCCASION_LABELS[run.occasion]}
              </Text>
            </View>
            <Text style={styles.heroTitle}>Deine besten Optionen für heute</Text>
            <Text numberOfLines={2} style={styles.heroSubtitle}>
              {run.contextLabel}
            </Text>
          </View>
        </View>

        <RecommendationCard
          inventoryById={inventoryById}
          isPrimary
          isSaved={savedRestaurants.isSaved(bestRecommendation.restaurant)}
          onDetail={() => openDetail(bestRecommendation.restaurant)}
          onNavigate={() => void openNavigation(bestRecommendation.restaurant)}
          onSave={() => void toggleSaved(bestRecommendation.restaurant)}
          recommendation={bestRecommendation}
          styles={styles}
        />

        {alternatives.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alternativen</Text>
            {alternatives.map((recommendation) => (
              <RecommendationCard
                inventoryById={inventoryById}
                isSaved={savedRestaurants.isSaved(recommendation.restaurant)}
                key={recommendation.restaurantId}
                onDetail={() => openDetail(recommendation.restaurant)}
                onNavigate={() => void openNavigation(recommendation.restaurant)}
                onSave={() => void toggleSaved(recommendation.restaurant)}
                recommendation={recommendation}
                styles={styles}
              />
            ))}
          </View>
        ) : null}

        <SignalSection
          recommendation={bestRecommendation}
          styles={styles}
          title="Warum diese Auswahl?"
          values={bestRecommendation.strengths}
        />
        <SignalSection
          muted
          recommendation={bestRecommendation}
          styles={styles}
          title="Worauf achten?"
          values={bestRecommendation.watchouts}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datenbasis</Text>
          <Text style={styles.sourceText}>
            Google Places, bis zu 5 Google-Reviews pro Restaurant,
            Wine-Scanner-Bewertungen und dein Bestand.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RecommendationCard({
  inventoryById,
  isPrimary = false,
  isSaved,
  onDetail,
  onNavigate,
  onSave,
  recommendation,
  styles,
}: {
  inventoryById: Map<string, InventoryListItem>;
  isPrimary?: boolean;
  isSaved: boolean;
  onDetail: () => void;
  onNavigate: () => void;
  onSave: () => void;
  recommendation: RestaurantAiRecommendation;
  styles: ReturnType<typeof makeStyles>;
}) {
  const restaurant = recommendation.restaurant;
  const matchingWines = recommendation.matchingInventoryItemIds
    .map((id) => inventoryById.get(id))
    .filter((item): item is InventoryListItem => Boolean(item));

  return (
    <View style={[styles.recommendationCard, isPrimary && styles.primaryCard]}>
      <View style={isPrimary ? styles.primaryImageWrap : styles.compactImageWrap}>
        <RestaurantImage restaurant={restaurant} styles={styles} />
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreValue}>{recommendation.score}</Text>
          <Text style={styles.scoreLabel}>Score</Text>
        </View>
      </View>

      <View style={styles.recommendationBody}>
        <View style={styles.roleRow}>
          <Text style={styles.roleLabel}>{recommendation.roleLabel}</Text>
          <Text style={styles.confidenceBadge}>
            {getConfidenceLabel(recommendation.confidence)}
          </Text>
        </View>
        <Text numberOfLines={2} style={styles.restaurantTitle}>
          {restaurant.name}
        </Text>
        <Text numberOfLines={1} style={styles.metaText}>
          {[restaurant.cuisine, formatDistance(restaurant.distanceMeters), `Google ${formatRating(restaurant.rating)}`]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Text numberOfLines={isPrimary ? 3 : 2} style={styles.reasonText}>
          {recommendation.reason}
        </Text>

        {recommendation.wineFit ? (
          <View style={styles.wineFitBox}>
            <Ionicons name="wine-outline" size={17} style={styles.wineFitIcon} />
            <Text numberOfLines={2} style={styles.wineFitText}>
              {recommendation.wineFit}
            </Text>
          </View>
        ) : null}

        {matchingWines.length > 0 ? (
          <View style={styles.matchingWineStack}>
            {matchingWines.slice(0, 3).map((item) => (
              <Text key={item.id} numberOfLines={1} style={styles.matchingWine}>
                {getInventoryLabel(item)}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable onPress={onDetail} style={styles.secondaryAction}>
            <Ionicons name="information-circle-outline" size={16} />
            <Text style={styles.secondaryActionText}>Details</Text>
          </Pressable>
          <Pressable onPress={onSave} style={styles.secondaryAction}>
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={16} />
            <Text style={styles.secondaryActionText}>
              {isSaved ? 'Gemerkt' : 'Merken'}
            </Text>
          </Pressable>
          <Pressable onPress={onNavigate} style={styles.primaryAction}>
            <Ionicons name="navigate" size={16} />
            <Text style={styles.primaryActionText}>Route</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SignalSection({
  muted = false,
  recommendation,
  styles,
  title,
  values,
}: {
  muted?: boolean;
  recommendation: RestaurantAiRecommendation;
  styles: ReturnType<typeof makeStyles>;
  title: string;
  values: string[];
}) {
  const signals = values.length > 0 ? values : recommendation.reviewSignals;

  if (signals.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.signalWrap}>
        {signals.slice(0, 5).map((signal) => (
          <View
            key={signal}
            style={[styles.signalChip, muted && styles.signalChipMuted]}
          >
            <Text style={[styles.signalText, muted && styles.signalTextMuted]}>
              {signal}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    compactImageWrap: {
      borderRadius: radii.lg,
      height: 150,
      overflow: 'hidden',
    },
    confidenceBadge: {
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      color: colors.textSecondary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    content: {
      gap: spacing.xl,
      paddingBottom: 120,
      paddingHorizontal: spacing.screenX,
    },
    emptyState: {
      alignItems: 'center',
      flex: 1,
      gap: spacing.md,
      justifyContent: 'center',
      padding: spacing.xl,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
      textAlign: 'center',
    },
    hero: {
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      minHeight: 250,
      overflow: 'hidden',
    },
    heroBadge: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    heroBadgeText: {
      color: colors.white,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    heroOverlay: {
      backgroundColor: colors.overlay,
      gap: spacing.sm,
      justifyContent: 'flex-end',
      minHeight: 250,
      padding: spacing.xl,
    },
    heroSubtitle: {
      color: colors.white,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.md,
      opacity: 0.9,
    },
    heroTitle: {
      color: colors.white,
      fontSize: typography.size.xxl,
      fontWeight: typography.weight.black,
      lineHeight: typography.lineHeight.xl,
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      height: 46,
      justifyContent: 'center',
      width: 46,
    },
    iconButtonGhost: {
      height: 46,
      width: 46,
    },
    loadingState: {
      alignItems: 'center',
      flex: 1,
      gap: spacing.md,
      justifyContent: 'center',
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    matchingWine: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    matchingWineStack: {
      gap: spacing.xs,
    },
    metaText: {
      color: colors.textSecondary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.md,
    },
    photo: {
      ...StyleSheet.absoluteFillObject,
    },
    photoFallback: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      flex: 1,
      justifyContent: 'center',
    },
    photoFallbackText: {
      color: colors.white,
      fontSize: typography.size.xxl,
      fontWeight: typography.weight.black,
    },
    primaryAction: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: 42,
      paddingHorizontal: spacing.md,
    },
    primaryActionText: {
      color: colors.white,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    primaryCard: {
      shadowColor: colors.shadow,
      shadowOffset: { height: 14, width: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 22,
    },
    primaryImageWrap: {
      borderRadius: radii.lg,
      height: 230,
      overflow: 'hidden',
    },
    reasonText: {
      color: colors.text,
      fontSize: typography.size.base,
      lineHeight: typography.lineHeight.base,
    },
    recommendationBody: {
      gap: spacing.sm,
      padding: spacing.lg,
    },
    recommendationCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      overflow: 'hidden',
    },
    restaurantTitle: {
      color: colors.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
      lineHeight: typography.lineHeight.xl,
    },
    roleLabel: {
      color: colors.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.extraBold,
      textTransform: 'uppercase',
    },
    roleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'space-between',
    },
    scoreBadge: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderColor: colors.white,
      borderRadius: radii.pill,
      borderWidth: 2,
      bottom: spacing.md,
      height: 70,
      justifyContent: 'center',
      position: 'absolute',
      right: spacing.md,
      width: 70,
    },
    scoreLabel: {
      color: colors.white,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
    scoreValue: {
      color: colors.white,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
      lineHeight: typography.lineHeight.xl,
    },
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    secondaryAction: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: 42,
      paddingHorizontal: spacing.md,
    },
    secondaryActionText: {
      color: colors.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    section: {
      gap: spacing.md,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
    },
    signalChip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    signalChipMuted: {
      backgroundColor: colors.surfaceWarm,
    },
    signalText: {
      color: colors.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.sm,
    },
    signalTextMuted: {
      color: colors.textSecondary,
    },
    signalWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    sourceText: {
      color: colors.textSecondary,
      fontSize: typography.size.md,
      lineHeight: typography.lineHeight.md,
    },
    topBar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.screenX,
      paddingVertical: spacing.md,
    },
    topBarTitle: {
      color: colors.text,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.black,
    },
    wineFitBox: {
      alignItems: 'flex-start',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
    },
    wineFitIcon: {
      color: colors.primary,
      marginTop: 2,
    },
    wineFitText: {
      color: colors.text,
      flex: 1,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.sm,
    },
  });
}
