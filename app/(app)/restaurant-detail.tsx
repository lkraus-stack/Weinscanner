import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AgeGateModal,
  AiConsentModal,
} from '@/components/compliance/AiComplianceModals';
import { StarPicker } from '@/components/ratings/StarPicker';
import { useAiComplianceGate } from '@/hooks/useAiComplianceGate';
import { useInventory, type InventoryListItem } from '@/hooks/useInventory';
import {
  useAnalyzeRestaurants,
  useLatestRestaurantAiRecommendation,
} from '@/hooks/useRestaurantAi';
import { useRestaurantDetail } from '@/hooks/useRestaurantDetail';
import { useRestaurantRating } from '@/hooks/useRestaurantRating';
import { useSavedRestaurants } from '@/hooks/useSavedRestaurants';
import { trackAdoptionEvent } from '@/lib/analytics';
import {
  RESTAURANT_AI_OCCASION_LABELS,
  getRestaurantVisits,
  saveRestaurantRating,
  saveRestaurantVisit,
} from '@/lib/restaurants';
import { useToastStore } from '@/stores/toast-store';
import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import type {
  Coordinates,
  RestaurantRatingRecord,
  RestaurantRecord,
} from '@/types/restaurant';

type RatingFormState = {
  notes: string;
  overallStars: number;
  wineStars: number;
};

type VisitFormState = {
  notes: string;
};

const DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function normalizeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumberParam(value: string | string[] | undefined) {
  const normalizedValue = normalizeParam(value);
  const parsedValue = normalizedValue ? Number(normalizedValue) : NaN;

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function parseProvider(value: string | string[] | undefined) {
  const normalizedValue = normalizeParam(value);

  return normalizedValue === 'google_places' || normalizedValue === 'fallback'
    ? normalizedValue
    : undefined;
}

function formatDistance(value: number | null) {
  if (value === null) {
    return 'Distanz offen';
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace('.', ',')} km`;
  }

  return `${value} m`;
}

function formatRating(value: number | null) {
  return value === null ? 'Neu' : value.toFixed(1).replace('.', ',');
}

function formatRatingCount(value: number | null) {
  if (value === null) {
    return 'Noch keine Google-Daten';
  }

  return `${value.toLocaleString('de-DE')} Bewertungen`;
}

function getRestaurantInitial(restaurant: Pick<RestaurantRecord, 'name'>) {
  return restaurant.name.trim().slice(0, 1).toLocaleUpperCase('de-DE') || 'O';
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Heute';
  }

  return DATE_FORMATTER.format(new Date(value));
}

function createRatingFormState(
  rating: RestaurantRatingRecord | null | undefined
): RatingFormState {
  return {
    notes: rating?.notes ?? '',
    overallStars: rating?.overall_stars ?? 0,
    wineStars: rating?.wine_stars ?? 0,
  };
}

function getTodayIso() {
  return new Date().toISOString();
}

function getInventoryLabel(item: InventoryListItem) {
  const wine = item.vintage?.wine;
  const year = item.vintage?.vintage_year;

  if (!wine) {
    return 'Unbekannter Wein';
  }

  return `${wine.producer} ${wine.wine_name}${year ? `, ${year}` : ''}`;
}

function getWineScore(item: InventoryListItem, restaurant: RestaurantRecord) {
  const wineColor = item.vintage?.wine?.wine_color;
  const types = restaurant.types.join(' ');
  const cuisine = restaurant.cuisine?.toLocaleLowerCase('de-DE') ?? '';

  if (!wineColor) {
    return 0;
  }

  if (types.includes('fine_dining')) {
    return item.quantity ? 3 : 1;
  }

  if (
    types.includes('italian') ||
    types.includes('mediterranean') ||
    cuisine.includes('italienisch') ||
    cuisine.includes('mediterran')
  ) {
    return ['rot', 'weiss', 'schaum'].includes(wineColor) ? 3 : 1;
  }

  if (types.includes('wine_bar')) {
    return item.quantity ? 2 : 1;
  }

  if (types.includes('cafe')) {
    return wineColor === 'schaum' || wineColor === 'weiss' ? 2 : 1;
  }

  return item.quantity ? 1 : 0;
}

function getRecommendedWines(
  inventoryItems: InventoryListItem[],
  restaurant: RestaurantRecord
) {
  return inventoryItems
    .map((item) => ({ item, score: getWineScore(item, restaurant) }))
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 3)
    .map(({ item }) => item);
}

function Stars({ value }: { value: number }) {
  const { colors } = useTheme();

  return (
    <View style={stylesStatic.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          color={star <= value ? colors.warning : colors.placeholder}
          key={star}
          name={star <= value ? 'star' : 'star-outline'}
          size={16}
        />
      ))}
    </View>
  );
}

export default function RestaurantDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    centerLat?: string;
    centerLng?: string;
    provider?: string;
    providerPlaceId?: string;
    restaurantId?: string;
    returnTo?: string;
    returnView?: string;
  }>();
  const center = useMemo<Coordinates | undefined>(() => {
    const lat = parseNumberParam(params.centerLat);
    const lng = parseNumberParam(params.centerLng);

    return typeof lat === 'number' && typeof lng === 'number'
      ? { lat, lng }
      : undefined;
  }, [params.centerLat, params.centerLng]);
  const provider = parseProvider(params.provider);
  const providerPlaceId = normalizeParam(params.providerPlaceId);
  const restaurantId = normalizeParam(params.restaurantId);
  const shouldReturnToDiscover = normalizeParam(params.returnTo) === 'discover';
  const returnView = normalizeParam(params.returnView) === 'list' ? 'list' : 'map';
  const detailQuery = useRestaurantDetail({
    center,
    provider,
    providerPlaceId,
    restaurantId,
  });
  const restaurant = detailQuery.data ?? null;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const showToast = useToastStore((state) => state.showToast);
  const queryClient = useQueryClient();
  const analyzeRestaurantsMutation = useAnalyzeRestaurants();
  const savedRestaurants = useSavedRestaurants();
  const { modalProps, requestAiAccess } = useAiComplianceGate();
  const ratingQuery = useRestaurantRating(restaurant);
  const latestAiQuery = useLatestRestaurantAiRecommendation(restaurant?.id);
  const inventoryQuery = useInventory({ hideEmptyInventory: true });
  const visitsQuery = useQuery({
    enabled: Boolean(restaurant?.id),
    queryFn: () => getRestaurantVisits(restaurant?.id ?? ''),
    queryKey: ['restaurant-visits', restaurant?.id],
    staleTime: 30_000,
  });
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isHoursExpanded, setIsHoursExpanded] = useState(false);
  const [ratingForm, setRatingForm] = useState<RatingFormState>(() =>
    createRatingFormState(null)
  );
  const [visitForm, setVisitForm] = useState<VisitFormState>({ notes: '' });
  const viewedRestaurantIdRef = useRef<string | null>(null);
  const inventoryItems = useMemo(
    () => inventoryQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [inventoryQuery.data?.pages]
  );
  const recommendedWines = useMemo(
    () => (restaurant ? getRecommendedWines(inventoryItems, restaurant) : []),
    [inventoryItems, restaurant]
  );
  const rating = ratingQuery.data?.rating ?? null;
  const currentWeekday = useMemo(
    () => new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(new Date()),
    []
  );
  const todayOpeningHour = useMemo(() => {
    const hours = restaurant?.openingHoursText ?? [];

    return (
      hours.find((line) =>
        line.toLocaleLowerCase('de-DE').startsWith(currentWeekday.toLocaleLowerCase('de-DE'))
      ) ??
      hours[0] ??
      null
    );
  }, [currentWeekday, restaurant?.openingHoursText]);
  const visibleOpeningHours =
    isHoursExpanded || !todayOpeningHour
      ? restaurant?.openingHoursText ?? []
      : [todayOpeningHour];

  useEffect(() => {
    if (!restaurant?.id || viewedRestaurantIdRef.current === restaurant.id) {
      return;
    }

    viewedRestaurantIdRef.current = restaurant.id;
    trackAdoptionEvent('restaurant_detail_viewed', { feature: 'discover' });
  }, [restaurant?.id]);

  function goBack() {
    let canGoBack = false;

    try {
      canGoBack = router.canGoBack();
    } catch {
      canGoBack = false;
    }

    if (canGoBack) {
      router.back();
      return;
    }

    if (shouldReturnToDiscover) {
      router.replace({
        pathname: '/(app)/discover' as never,
        params: { preferredView: returnView },
      });
      return;
    }

    router.replace('/(app)' as never);
  }

  const saveRatingMutation = useMutation({
    mutationFn: async () => {
      if (!restaurant) {
        throw new Error('Restaurant fehlt.');
      }

      return saveRestaurantRating({
        notes: ratingForm.notes,
        overallStars: ratingForm.overallStars,
        restaurant,
        visitedAt: getTodayIso(),
        wineStars: ratingForm.wineStars,
      });
    },
    onSuccess: async () => {
      if (restaurant) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['restaurant-rating'],
          }),
          queryClient.invalidateQueries({
            queryKey: ['restaurant-detail'],
          }),
        ]);
        trackAdoptionEvent('restaurant_rated', { feature: 'discover' });
      }
      setIsRatingModalOpen(false);
      showToast('Restaurant-Bewertung gespeichert');
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : 'Bewertung fehlgeschlagen'
      );
    },
  });

  const visitMutation = useMutation({
    mutationFn: async (item: InventoryListItem | null) => {
      if (!restaurant) {
        throw new Error('Restaurant fehlt.');
      }

      return saveRestaurantVisit({
        inventoryItemId: item?.id ?? null,
        notes: visitForm.notes,
        restaurant,
        visitedAt: getTodayIso(),
        vintageId: item?.vintage_id ?? null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['restaurant-visits'] });
      setIsVisitModalOpen(false);
      setVisitForm({ notes: '' });
      showToast('Restaurant-Besuch gespeichert');
    },
    onError: (error) => {
      showToast(
        error instanceof Error
          ? error.message
          : 'Besuch konnte nicht gespeichert werden.'
      );
    },
  });

  if (detailQuery.isLoading) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Zurück zur Restaurant-Suche"
            accessibilityRole="button"
            onPress={goBack}
            style={styles.iconButton}
          >
            <Ionicons color={colors.text} name="chevron-back" size={26} />
          </Pressable>
        </View>
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Restaurant laden</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyState}>
          <Ionicons color={colors.primary} name="restaurant-outline" size={34} />
          <Text style={styles.emptyTitle}>Restaurant nicht gefunden</Text>
          <Text style={styles.emptyText}>
            Bitte öffne das Restaurant erneut aus dem Entdecken-Tab.
          </Text>
          <Pressable
            accessibilityLabel="Zurück zur Restaurant-Suche"
            accessibilityRole="button"
            onPress={goBack}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Zurück</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const activeRestaurant = restaurant as RestaurantRecord;
  const isSaved = savedRestaurants.isSaved(activeRestaurant);

  async function toggleSaved() {
    try {
      await Haptics.selectionAsync();

      if (savedRestaurants.isSaved(activeRestaurant)) {
        await savedRestaurants.remove(activeRestaurant);
        showToast('Restaurant entfernt');
      } else {
        await savedRestaurants.save(activeRestaurant);
        trackAdoptionEvent('restaurant_saved', { feature: 'discover' });
        showToast('Restaurant gemerkt');
      }
    } catch {
      showToast('Restaurant konnte nicht gespeichert werden.');
    }
  }

  async function openNavigation() {
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${activeRestaurant.location.lat},${activeRestaurant.location.lng}`;
    const url = activeRestaurant.googleMapsUri ?? fallbackUrl;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Navigation nicht verfügbar',
        'Der Google Maps Link konnte nicht geöffnet werden.'
      );
    }
  }

  async function openPhone() {
    if (!activeRestaurant.phone) {
      return;
    }

    await Linking.openURL(`tel:${activeRestaurant.phone.replace(/\s/g, '')}`);
  }

  async function openWebsite() {
    if (!activeRestaurant.websiteUrl) {
      return;
    }

    await Linking.openURL(activeRestaurant.websiteUrl);
  }

  function openRatingModal() {
    setRatingForm(createRatingFormState(rating));
    setIsRatingModalOpen(true);
  }

  function submitRating() {
    if (ratingForm.overallStars < 1 || ratingForm.wineStars < 1) {
      showToast('Bitte beide Sternbewertungen setzen.');
      return;
    }

    saveRatingMutation.mutate();
  }

  function submitVisit(item: InventoryListItem | null) {
    visitMutation.mutate(item);
  }

  async function runDetailAiAnalysis() {
    try {
      trackAdoptionEvent('restaurant_ai_recommendation_requested', {
        feature: 'discover',
        tags: { entry: 'detail', occasion: 'wine_focus' },
      });
      const run = await analyzeRestaurantsMutation.mutateAsync({
        center: activeRestaurant.location,
        contextLabel: `${activeRestaurant.name} · ${RESTAURANT_AI_OCCASION_LABELS.wine_focus}`,
        occasion: 'wine_focus',
        restaurants: [activeRestaurant],
      });

      router.push({
        pathname: '/restaurant-ai-results' as never,
        params: { runId: run.id },
      });
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'KI-Einschätzung konnte nicht erstellt werden.'
      );
    }
  }

  function startDetailAiAnalysis() {
    requestAiAccess(runDetailAiAnalysis);
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Zurück zur Restaurant-Suche"
          accessibilityRole="button"
          onPress={goBack}
          style={styles.iconButton}
        >
          <Ionicons color={colors.text} name="chevron-back" size={26} />
        </Pressable>
        <View style={styles.topBarActions}>
          <Pressable onPress={toggleSaved} style={styles.iconButton}>
            <Ionicons
              color={isSaved ? colors.primary : colors.text}
              name={isSaved ? 'heart' : 'heart-outline'}
              size={24}
            />
          </Pressable>
          <Pressable onPress={openNavigation} style={styles.iconButton}>
            <Ionicons color={colors.text} name="navigate-outline" size={23} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {restaurant.photoUrl ? (
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: restaurant.photoUrl }}
              style={styles.heroImage}
            />
          ) : (
            <View style={styles.heroFallback}>
              <Text style={styles.heroFallbackInitial}>
                {getRestaurantInitial(restaurant)}
              </Text>
              <Text numberOfLines={1} style={styles.heroFallbackCuisine}>
                {restaurant.cuisine ?? 'Restaurant'}
              </Text>
            </View>
          )}
          <View style={styles.heroOverlay}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.openStatusDot,
                  restaurant.isOpenNow === false && styles.closedStatusDot,
                ]}
              />
              <Text style={styles.statusText}>
                {restaurant.isOpenNow === false
                  ? 'Aktuell geschlossen'
                  : 'Jetzt offen oder unbekannt'}
              </Text>
            </View>
            {restaurant.qualityLabel ? (
              <View style={styles.heroQualityPill}>
                <Ionicons color={colors.white} name="checkmark-circle" size={15} />
                <Text style={styles.heroQualityText}>
                  {restaurant.qualityLabel}
                  {restaurant.qualityScore ? ` · ${restaurant.qualityScore}` : ''}
                </Text>
              </View>
            ) : null}
            <Text style={styles.title}>{restaurant.name}</Text>
            <Text style={styles.subtitle}>
              {[restaurant.cuisine, restaurant.address].filter(Boolean).join(' · ') ||
                'Adresse wird geladen'}
            </Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <Pressable onPress={openNavigation} style={styles.primaryAction}>
            <Ionicons color={colors.white} name="navigate" size={18} />
            <Text style={styles.primaryActionText}>Route</Text>
          </Pressable>
          <Pressable onPress={toggleSaved} style={styles.secondaryAction}>
            <Ionicons
              color={colors.primary}
              name={isSaved ? 'heart' : 'heart-outline'}
              size={18}
            />
            <Text style={styles.secondaryActionText}>
              {isSaved ? 'Gemerkt' : 'Merken'}
            </Text>
          </Pressable>
          <Pressable onPress={openRatingModal} style={styles.secondaryAction}>
            <Ionicons color={colors.primary} name="star-outline" size={18} />
            <Text style={styles.secondaryActionText}>Bewerten</Text>
          </Pressable>
          <Pressable
            onPress={() => setIsVisitModalOpen(true)}
            style={styles.secondaryAction}
          >
            <Ionicons color={colors.primary} name="wine-outline" size={18} />
            <Text style={styles.secondaryActionText}>Ich war hier</Text>
          </Pressable>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard
            icon="logo-google"
            label="Google"
            styles={styles}
            value={formatRating(restaurant.rating)}
          />
          <MetricCard
            icon="people-outline"
            label="Bewertungen"
            styles={styles}
            value={formatRatingCount(restaurant.ratingCount)}
          />
          <MetricCard
            icon="walk-outline"
            label="Distanz"
            styles={styles}
            value={formatDistance(restaurant.distanceMeters)}
          />
          <MetricCard
            icon="cash-outline"
            label="Preis"
            styles={styles}
            value={restaurant.priceLevel ?? 'Offen'}
          />
        </View>

        {restaurant.qualitySignals.length > 0 ? (
          <Section title="Qualitätssignale" styles={styles}>
            <View style={styles.signalWrap}>
              {restaurant.qualitySignals.map((signal) => (
                <View key={signal} style={styles.signalChip}>
                  <Ionicons
                    color={colors.success}
                    name="checkmark-circle"
                    size={15}
                  />
                  <Text style={styles.signalText}>{signal}</Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        <Section title="KI-Einschätzung" styles={styles}>
          {latestAiQuery.data ? (
            <View style={styles.aiInsightCard}>
              <View style={styles.aiInsightHeader}>
                <View style={styles.aiScoreBadge}>
                  <Text style={styles.aiScoreValue}>
                    {latestAiQuery.data.score}
                  </Text>
                  <Text style={styles.aiScoreLabel}>Score</Text>
                </View>
                <View style={styles.aiInsightCopy}>
                  <Text style={styles.aiInsightRole}>
                    {latestAiQuery.data.roleLabel}
                  </Text>
                  <Text style={styles.aiInsightHeadline}>
                    {latestAiQuery.data.headline}
                  </Text>
                </View>
              </View>
              <Text style={styles.aiInsightReason}>
                {latestAiQuery.data.reason}
              </Text>
              {latestAiQuery.data.wineFit ? (
                <Text style={styles.aiInsightWine}>
                  {latestAiQuery.data.wineFit}
                </Text>
              ) : null}
              <Pressable
                disabled={analyzeRestaurantsMutation.isPending}
                onPress={() => void startDetailAiAnalysis()}
                style={styles.secondaryAction}
              >
                {analyzeRestaurantsMutation.isPending ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
                )}
                <Text style={styles.secondaryActionText}>
                  Analyse aktualisieren
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyPanel}>
              <Ionicons color={colors.primary} name="sparkles-outline" size={22} />
              <Text style={styles.emptyPanelTitle}>
                Noch keine KI-Einschätzung
              </Text>
              <Text style={styles.emptyPanelText}>
                Lass Bewertungen, Anlass und Wein-Fit als kurze Empfehlung prüfen.
              </Text>
              <Pressable
                disabled={analyzeRestaurantsMutation.isPending}
                onPress={() => void startDetailAiAnalysis()}
                style={styles.primaryAction}
              >
                {analyzeRestaurantsMutation.isPending ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Ionicons color={colors.white} name="sparkles" size={18} />
                )}
                <Text style={styles.primaryActionText}>
                  KI einschätzen lassen
                </Text>
              </Pressable>
            </View>
          )}
        </Section>

        <Section title="Wine Scanner Bewertung" styles={styles}>
          {rating ? (
            <View style={styles.ownRatingCard}>
              <View style={styles.ratingLine}>
                <Text style={styles.ratingLabel}>Gesamt</Text>
                <Stars value={rating.overall_stars} />
              </View>
              <View style={styles.ratingLine}>
                <Text style={styles.ratingLabel}>Wein-Erlebnis</Text>
                <Stars value={rating.wine_stars} />
              </View>
              {rating.notes ? (
                <Text style={styles.noteText}>{rating.notes}</Text>
              ) : null}
              <Text style={styles.caption}>
                Besucht: {formatDate(rating.visited_at)}
              </Text>
            </View>
          ) : (
            <View style={styles.emptyPanel}>
              <Ionicons color={colors.primary} name="star-outline" size={22} />
              <Text style={styles.emptyPanelTitle}>
                Noch keine eigene Bewertung
              </Text>
              <Text style={styles.emptyPanelText}>
                Halte fest, ob Küche, Atmosphäre und Weinkarte wirklich zu dir passen.
              </Text>
            </View>
          )}
        </Section>

        <Section title="Aus deinem Bestand passend" styles={styles}>
          {recommendedWines.length > 0 ? (
            <View style={styles.wineStack}>
              {recommendedWines.map((item) => (
                <View key={item.id} style={styles.wineRecommendation}>
                  <Ionicons
                    color={colors.primary}
                    name="wine-outline"
                    size={20}
                  />
                  <View style={styles.wineRecommendationBody}>
                    <Text numberOfLines={2} style={styles.wineRecommendationTitle}>
                      {getInventoryLabel(item)}
                    </Text>
                    <Text style={styles.wineRecommendationMeta}>
                      Bestand {item.quantity ?? 0}
                      {item.storage_location ? ` · ${item.storage_location}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.sectionHint}>
              Noch keine passende Flasche im Bestand erkannt.
            </Text>
          )}
        </Section>

        <Section title="Öffnungszeiten" styles={styles}>
          {visibleOpeningHours.length > 0 ? (
            <View style={styles.hoursCard}>
              {visibleOpeningHours.map((line) => (
                <View key={line} style={styles.hourRow}>
                  <Ionicons color={colors.primary} name="time-outline" size={18} />
                  <Text style={styles.hourText}>{line}</Text>
                </View>
              ))}
              {restaurant.openingHoursText.length > 1 ? (
                <Pressable
                  onPress={() => setIsHoursExpanded((current) => !current)}
                  style={styles.hoursToggle}
                >
                  <Text style={styles.hoursToggleText}>
                    {isHoursExpanded ? 'Weniger anzeigen' : 'Alle Tage anzeigen'}
                  </Text>
                  <Ionicons
                    color={colors.primary}
                    name={isHoursExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                  />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Text style={styles.sectionHint}>Keine Öffnungszeiten verfügbar.</Text>
          )}
        </Section>

        <Section title="Kontakt und Ort" styles={styles}>
          <View style={styles.contactGrid}>
            <ContactItem
              icon="location-outline"
              label="Adresse"
              styles={styles}
              value={restaurant.address ?? 'Noch offen'}
            />
            <ContactItem
              icon="restaurant-outline"
              label="Küche"
              styles={styles}
              value={restaurant.cuisine ?? 'Restaurant'}
            />
            {restaurant.phone ? (
              <ContactItem
                icon="call-outline"
                label="Telefon"
                styles={styles}
                value={restaurant.phone}
              />
            ) : null}
            {restaurant.websiteUrl ? (
              <ContactItem
                icon="globe-outline"
                label="Website"
                styles={styles}
                value="Website öffnen"
              />
            ) : null}
          </View>
          <View style={styles.contactActions}>
            {restaurant.phone ? (
              <Pressable onPress={openPhone} style={styles.secondaryAction}>
                <Ionicons color={colors.primary} name="call-outline" size={18} />
                <Text style={styles.secondaryActionText}>Anrufen</Text>
              </Pressable>
            ) : null}
            {restaurant.websiteUrl ? (
              <Pressable onPress={openWebsite} style={styles.secondaryAction}>
                <Ionicons color={colors.primary} name="globe-outline" size={18} />
                <Text style={styles.secondaryActionText}>Website</Text>
              </Pressable>
            ) : null}
          </View>
        </Section>

        <Section title="Besuche" styles={styles}>
          {visitsQuery.data && visitsQuery.data.length > 0 ? (
            <View style={styles.visitStack}>
              {visitsQuery.data.map((visit) => (
                <View key={visit.id} style={styles.visitCard}>
                  <Text style={styles.visitDate}>{formatDate(visit.visited_at)}</Text>
                  <Text style={styles.visitWine}>
                    {visit.wineLabel ?? 'Ohne Wein verknüpft'}
                  </Text>
                  {visit.notes ? (
                    <Text style={styles.noteText}>{visit.notes}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.sectionHint}>Noch kein Besuch gespeichert.</Text>
          )}
        </Section>
      </ScrollView>

      <RatingModalContent
        isOpen={isRatingModalOpen}
        isSaving={saveRatingMutation.isPending}
        onChange={setRatingForm}
        onClose={() => setIsRatingModalOpen(false)}
        onSubmit={submitRating}
        styles={styles}
        value={ratingForm}
      />
      <VisitModalContent
        inventoryItems={inventoryItems}
        inventoryQuery={inventoryQuery}
        isOpen={isVisitModalOpen}
        isSaving={visitMutation.isPending}
        onChange={setVisitForm}
        onClose={() => setIsVisitModalOpen(false)}
        onSubmit={submitVisit}
        styles={styles}
        value={visitForm}
      />
      <AgeGateModal {...modalProps.ageGate} />
      <AiConsentModal {...modalProps.aiConsent} />
    </SafeAreaView>
  );
}

function Section({
  children,
  styles,
  title,
}: {
  children: ReactNode;
  styles: ReturnType<typeof makeStyles>;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MetricCard({
  icon,
  label,
  styles,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  styles: ReturnType<typeof makeStyles>;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={18} style={styles.metricIcon} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

function ContactItem({
  icon,
  label,
  styles,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  styles: ReturnType<typeof makeStyles>;
  value: string;
}) {
  return (
    <View style={styles.contactItem}>
      <View style={styles.contactIcon}>
        <Ionicons name={icon} size={18} style={styles.contactIconGlyph} />
      </View>
      <View style={styles.contactCopy}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
    </View>
  );
}

function RatingModalContent({
  isOpen,
  isSaving,
  onChange,
  onClose,
  onSubmit,
  styles,
  value,
}: {
  isOpen: boolean;
  isSaving: boolean;
  onChange: (value: RatingFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  styles: ReturnType<typeof makeStyles>;
  value: RatingFormState;
}) {
  const { colors } = useTheme();

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={isOpen}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Restaurant bewerten</Text>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={22} style={styles.modalCloseIcon} />
            </Pressable>
          </View>
          <Text style={styles.modalLabel}>Gesamtbewertung</Text>
          <StarPicker
            disabled={isSaving}
            onChange={(overallStars) => onChange({ ...value, overallStars })}
            value={value.overallStars}
          />
          <Text style={styles.modalLabel}>Wein-Erlebnis</Text>
          <StarPicker
            disabled={isSaving}
            onChange={(wineStars) => onChange({ ...value, wineStars })}
            value={value.wineStars}
          />
          <TextInput
            multiline
            onChangeText={(notes) => onChange({ ...value, notes })}
            placeholder="Notiz zur Küche, Weinkarte oder Atmosphäre"
            placeholderTextColor={colors.placeholder}
            style={styles.modalInput}
            value={value.notes}
          />
          <Pressable
            disabled={isSaving}
            onPress={onSubmit}
            style={[styles.modalPrimaryButton, isSaving && styles.disabledButton]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.modalPrimaryButtonText}>Speichern</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function VisitModalContent({
  inventoryItems,
  inventoryQuery,
  isOpen,
  isSaving,
  onChange,
  onClose,
  onSubmit,
  styles,
  value,
}: {
  inventoryItems: InventoryListItem[];
  inventoryQuery: ReturnType<typeof useInventory>;
  isOpen: boolean;
  isSaving: boolean;
  onChange: (value: VisitFormState) => void;
  onClose: () => void;
  onSubmit: (item: InventoryListItem | null) => void;
  styles: ReturnType<typeof makeStyles>;
  value: VisitFormState;
}) {
  const { colors } = useTheme();

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={isOpen}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Besuch speichern</Text>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={22} style={styles.modalCloseIcon} />
            </Pressable>
          </View>
          <Text style={styles.modalDescription}>
            Verknüpfe optional einen Wein aus deinem Bestand. Die Menge wird nicht verändert.
          </Text>
          <TextInput
            multiline
            onChangeText={(notes) => onChange({ notes })}
            placeholder="Notiz zum Besuch"
            placeholderTextColor={colors.placeholder}
            style={styles.modalInput}
            value={value.notes}
          />
          <Pressable
            disabled={isSaving}
            onPress={() => onSubmit(null)}
            style={styles.visitOption}
          >
            <Ionicons name="checkmark-circle-outline" size={20} style={styles.visitOptionIcon} />
            <View style={styles.visitOptionBody}>
              <Text style={styles.visitOptionTitle}>Ohne Wein speichern</Text>
              <Text style={styles.visitOptionMeta}>Nur Restaurant-Besuch merken</Text>
            </View>
          </Pressable>
          <ScrollView style={styles.inventoryList}>
            {inventoryItems.map((item) => (
              <Pressable
                disabled={isSaving}
                key={item.id}
                onPress={() => onSubmit(item)}
                style={styles.visitOption}
              >
                <Ionicons name="wine-outline" size={20} style={styles.visitOptionIcon} />
                <View style={styles.visitOptionBody}>
                  <Text numberOfLines={2} style={styles.visitOptionTitle}>
                    {getInventoryLabel(item)}
                  </Text>
                  <Text numberOfLines={1} style={styles.visitOptionMeta}>
                    Bestand {item.quantity ?? 0}
                    {item.storage_location ? ` · ${item.storage_location}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
            {inventoryQuery.hasNextPage ? (
              <Pressable
                disabled={inventoryQuery.isFetchingNextPage}
                onPress={() => void inventoryQuery.fetchNextPage()}
                style={styles.loadMoreButton}
              >
                {inventoryQuery.isFetchingNextPage ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.loadMoreText}>Mehr Bestand laden</Text>
                )}
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const stylesStatic = StyleSheet.create({
  starsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    aiInsightCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg,
    },
    aiInsightCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    aiInsightHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    aiInsightHeadline: {
      color: colors.text,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.black,
      lineHeight: typography.lineHeight.lg,
    },
    aiInsightReason: {
      color: colors.text,
      fontSize: typography.size.base,
      lineHeight: typography.lineHeight.base,
    },
    aiInsightRole: {
      color: colors.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.extraBold,
      textTransform: 'uppercase',
    },
    aiInsightWine: {
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      color: colors.textSecondary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.md,
      padding: spacing.md,
    },
    aiScoreBadge: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      height: 64,
      justifyContent: 'center',
      width: 64,
    },
    aiScoreLabel: {
      color: colors.white,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
    aiScoreValue: {
      color: colors.white,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
      lineHeight: typography.lineHeight.xl,
    },
    caption: {
      color: colors.placeholder,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    closedStatusDot: {
      backgroundColor: colors.textSecondary,
    },
    contactActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    contactCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    contactGrid: {
      gap: spacing.sm,
    },
    contactIcon: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderRadius: radii.md,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    contactIconGlyph: {
      color: colors.primary,
    },
    contactItem: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
    },
    contactLabel: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    contactValue: {
      color: colors.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.md,
    },
    content: {
      gap: spacing.xl,
      paddingBottom: 120,
      paddingHorizontal: spacing.screenX,
    },
    disabledButton: {
      opacity: 0.6,
    },
    emptyPanel: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.lg,
    },
    emptyPanelText: {
      color: colors.textSecondary,
      fontSize: typography.size.md,
      lineHeight: typography.lineHeight.md,
    },
    emptyPanelTitle: {
      color: colors.text,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.black,
    },
    emptyState: {
      alignItems: 'center',
      flex: 1,
      gap: spacing.md,
      justifyContent: 'center',
      padding: spacing.xxl,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.size.md,
      lineHeight: typography.lineHeight.md,
      textAlign: 'center',
    },
    emptyTitle: {
      color: colors.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
    },
    hero: {
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      minHeight: 290,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { height: 12, width: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
    },
    heroFallback: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      flex: 1,
      gap: spacing.xs,
      justifyContent: 'center',
      minHeight: 290,
    },
    heroFallbackCuisine: {
      color: colors.white,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
      opacity: 0.86,
    },
    heroFallbackInitial: {
      color: colors.white,
      fontSize: 58,
      fontWeight: typography.weight.black,
      lineHeight: 64,
    },
    heroImage: {
      ...StyleSheet.absoluteFillObject,
    },
    heroOverlay: {
      backgroundColor: colors.overlay,
      gap: spacing.sm,
      justifyContent: 'flex-end',
      minHeight: 290,
      padding: spacing.xl,
    },
    heroQualityPill: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.success,
      borderRadius: radii.pill,
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    heroQualityText: {
      color: colors.white,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.black,
    },
    hourRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    hoursCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg,
    },
    hoursToggle: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    hoursToggleText: {
      color: colors.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    hourText: {
      color: colors.text,
      flex: 1,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.md,
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
    infoCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      overflow: 'hidden',
    },
    infoLabel: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
      width: 82,
    },
    infoRow: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
    },
    infoValue: {
      color: colors.text,
      flex: 1,
      fontSize: typography.size.md,
      lineHeight: typography.lineHeight.md,
    },
    inventoryList: {
      maxHeight: 280,
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
    loadMoreButton: {
      alignItems: 'center',
      padding: spacing.md,
    },
    loadMoreText: {
      color: colors.primary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    metricCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexBasis: '47%',
      gap: spacing.xs,
      minHeight: 106,
      padding: spacing.lg,
    },
    metricIcon: {
      color: colors.primary,
    },
    metricLabel: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
      textTransform: 'uppercase',
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    metricValue: {
      color: colors.text,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.black,
      lineHeight: typography.lineHeight.lg,
    },
    modalBackdrop: {
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalCloseButton: {
      alignItems: 'center',
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    modalCloseIcon: {
      color: colors.text,
    },
    modalDescription: {
      color: colors.textSecondary,
      fontSize: typography.size.md,
      lineHeight: typography.lineHeight.md,
    },
    modalHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    modalInput: {
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.base,
      minHeight: 96,
      padding: spacing.md,
      textAlignVertical: 'top',
    },
    modalLabel: {
      color: colors.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.black,
    },
    modalPrimaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      minHeight: 48,
      justifyContent: 'center',
    },
    modalPrimaryButtonText: {
      color: colors.white,
      fontSize: typography.size.base,
      fontWeight: typography.weight.bold,
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      gap: spacing.lg,
      maxHeight: '88%',
      padding: spacing.xl,
    },
    modalTitle: {
      color: colors.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
    },
    noteText: {
      color: colors.text,
      fontSize: typography.size.base,
      lineHeight: typography.lineHeight.base,
    },
    openStatusDot: {
      backgroundColor: colors.success,
      borderRadius: 5,
      height: 10,
      width: 10,
    },
    ownRatingCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg,
    },
    primaryAction: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
    },
    primaryActionText: {
      color: colors.white,
      fontSize: typography.size.md,
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
    quickActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    ratingLabel: {
      color: colors.text,
      flex: 1,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    ratingLine: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    secondaryAction: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
    },
    secondaryActionText: {
      color: colors.primary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    section: {
      gap: spacing.md,
    },
    sectionHint: {
      color: colors.textSecondary,
      fontSize: typography.size.md,
      lineHeight: typography.lineHeight.md,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
    },
    signalChip: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    signalText: {
      color: colors.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    signalWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    statusRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    statusText: {
      color: colors.white,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    subtitle: {
      color: colors.white,
      fontSize: typography.size.base,
      lineHeight: typography.lineHeight.base,
    },
    title: {
      color: colors.white,
      fontSize: typography.size.xxl,
      fontWeight: typography.weight.black,
      lineHeight: typography.lineHeight.xl,
    },
    topBar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.screenX,
    },
    topBarActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    visitCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.lg,
    },
    visitDate: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    visitOption: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
    },
    visitOptionBody: {
      flex: 1,
      gap: spacing.xs,
    },
    visitOptionIcon: {
      color: colors.primary,
    },
    visitOptionMeta: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
    },
    visitOptionTitle: {
      color: colors.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.md,
    },
    visitStack: {
      gap: spacing.sm,
    },
    visitWine: {
      color: colors.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.md,
    },
    wineRecommendation: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
    },
    wineRecommendationBody: {
      flex: 1,
      gap: spacing.xs,
    },
    wineRecommendationMeta: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
    },
    wineRecommendationTitle: {
      color: colors.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.md,
    },
    wineStack: {
      gap: spacing.sm,
    },
  });
}
