import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  type GestureResponderEvent,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AgeGateModal,
  AiConsentModal,
} from '@/components/compliance/AiComplianceModals';
import { WineIndicatorBadge } from '@/components/discover/WineIndicatorBadge';
import { useAiComplianceGate } from '@/hooks/useAiComplianceGate';
import { usePreferences } from '@/hooks/usePreferences';
import { useAnalyzeRestaurants } from '@/hooks/useRestaurantAi';
import { useRestaurantSearch } from '@/hooks/useRestaurantSearch';
import { useSavedRestaurants } from '@/hooks/useSavedRestaurants';
import { env } from '@/lib/env';
import {
  sanitizeCityTag,
  trackAdoptionEvent,
} from '@/lib/analytics';
import {
  DEFAULT_RESTAURANT_REGION,
  RESTAURANT_AI_OCCASION_LABELS,
  geocodeRestaurantCity,
  getBoundsFromRegion,
} from '@/lib/restaurants';
import { useToastStore } from '@/stores/toast-store';
import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import type {
  RestaurantAiOccasion,
  RestaurantQualityMode,
  RestaurantRecord,
  RestaurantViewMode,
} from '@/types/restaurant';

type DiscoverMode = 'saved' | 'search';

type FilterOption<T> = {
  label: string;
  value: T;
};

type MapPoint =
  | {
      coordinate: { latitude: number; longitude: number };
      restaurant: RestaurantRecord;
      type: 'restaurant';
    }
  | {
      coordinate: { latitude: number; longitude: number };
      count: number;
      id: string;
      restaurants: RestaurantRecord[];
      type: 'cluster';
    };

const RATING_FILTERS: FilterOption<number | null>[] = [
  { label: 'Alle', value: null },
  { label: '4+', value: 4 },
  { label: '4,5+', value: 4.5 },
];

const DISTANCE_FILTERS: FilterOption<number>[] = [
  { label: '1 km', value: 1000 },
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
];

const QUALITY_FILTERS: FilterOption<RestaurantQualityMode>[] = [
  { label: 'Smart empfohlen', value: 'smart' },
  { label: 'Sehr streng', value: 'strict' },
  { label: 'Aus', value: 'off' },
];

const CUISINE_FILTERS: FilterOption<string | null>[] = [
  { label: 'Alle', value: null },
  { label: 'Weinbar', value: 'wine_bar' },
  { label: 'Fine Dining', value: 'fine_dining_restaurant' },
  { label: 'Italienisch', value: 'italian_restaurant' },
  { label: 'Französisch', value: 'french_restaurant' },
  { label: 'Deutsch', value: 'german_restaurant' },
  { label: 'Mediterran', value: 'mediterranean_restaurant' },
  { label: 'Café', value: 'cafe' },
  { label: 'Bar', value: 'bar' },
];

const AI_OCCASIONS: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: RestaurantAiOccasion;
}[] = [
  {
    description: 'Schnell gut essen, ohne lang zu suchen.',
    icon: 'flash-outline',
    value: 'quick_bite',
  },
  {
    description: 'Ruhiger Abend mit guter Küche und Atmosphäre.',
    icon: 'moon-outline',
    value: 'nice_evening',
  },
  {
    description: 'Für besondere Anlässe und starke Eindrücke.',
    icon: 'sparkles-outline',
    value: 'special_experience',
  },
  {
    description: 'Restaurants, bei denen Wein mehr zählt.',
    icon: 'wine-outline',
    value: 'wine_focus',
  },
  {
    description: 'Verlässliche Orte für eine fremde Stadt.',
    icon: 'map-outline',
    value: 'travel',
  },
];

function getInitialRegion(
  preferences: ReturnType<typeof usePreferences>['preferences']
) {
  const center = preferences.restaurant_discovery.last_map_center;

  if (!center) {
    return DEFAULT_RESTAURANT_REGION;
  }

  return {
    latitude: center.lat,
    latitudeDelta: DEFAULT_RESTAURANT_REGION.latitudeDelta,
    longitude: center.lng,
    longitudeDelta: DEFAULT_RESTAURANT_REGION.longitudeDelta,
  };
}

function getRegionCenter(region: Region) {
  return {
    lat: region.latitude,
    lng: region.longitude,
  };
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

function formatRating(value: number | null) {
  return value === null ? 'Neu' : value.toFixed(1).replace('.', ',');
}

function getPriceLabel(value: string | null) {
  return value ?? 'Preis offen';
}

function getCuisineLabel(value: string | null) {
  return CUISINE_FILTERS.find((option) => option.value === value)?.label ?? 'Alle';
}

function getDistanceLabel(value: number) {
  return DISTANCE_FILTERS.find((option) => option.value === value)?.label ?? '5 km';
}

function getQualityLabel(value: RestaurantQualityMode) {
  switch (value) {
    case 'off':
      return 'Qualität aus';
    case 'strict':
      return 'Sehr streng';
    case 'smart':
      return 'Smart';
  }
}

function normalizeRestaurantViewMode(value: string | string[] | undefined) {
  const normalizedValue = Array.isArray(value) ? value[0] : value;

  return normalizedValue === 'list' || normalizedValue === 'map'
    ? normalizedValue
    : null;
}

function getRestaurantInitial(restaurant: Pick<RestaurantRecord, 'name'>) {
  return restaurant.name.trim().slice(0, 1).toLocaleUpperCase('de-DE') || 'O';
}

function getQualityTone(
  restaurant: Pick<RestaurantRecord, 'isOpenNow' | 'qualityScore'>,
  colors: ThemeColors
) {
  if (restaurant.isOpenNow === false) {
    return colors.textSecondary;
  }

  if ((restaurant.qualityScore ?? 0) >= 88) {
    return colors.success;
  }

  if ((restaurant.qualityScore ?? 0) >= 76) {
    return colors.primary;
  }

  return colors.warning;
}

function buildMapPoints(restaurants: RestaurantRecord[]): MapPoint[] {
  if (restaurants.length <= 15) {
    return restaurants.map((restaurant) => ({
      coordinate: {
        latitude: restaurant.location.lat,
        longitude: restaurant.location.lng,
      },
      restaurant,
      type: 'restaurant',
    }));
  }

  const groups = new Map<string, RestaurantRecord[]>();

  for (const restaurant of restaurants) {
    const key = `${restaurant.location.lat.toFixed(2)}:${restaurant.location.lng.toFixed(2)}`;
    const group = groups.get(key) ?? [];

    group.push(restaurant);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([id, group]) => {
    if (group.length === 1) {
      const [restaurant] = group;

      return {
        coordinate: {
          latitude: restaurant.location.lat,
          longitude: restaurant.location.lng,
        },
        restaurant,
        type: 'restaurant',
      };
    }

    const latitude =
      group.reduce((sum, restaurant) => sum + restaurant.location.lat, 0) /
      group.length;
    const longitude =
      group.reduce((sum, restaurant) => sum + restaurant.location.lng, 0) /
      group.length;

    return {
      coordinate: { latitude, longitude },
      count: group.length,
      id,
      restaurants: group,
      type: 'cluster',
    };
  });
}

export default function DiscoverScreen() {
  const mapRef = useRef<MapView | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{ preferredView?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const preferencesQuery = usePreferences();
  const analyzeRestaurantsMutation = useAnalyzeRestaurants();
  const savedRestaurants = useSavedRestaurants();
  const showToast = useToastStore((state) => state.showToast);
  const { modalProps, requestAiAccess } = useAiComplianceGate();
  const initialRegion = useMemo(
    () => getInitialRegion(preferencesQuery.preferences),
    [preferencesQuery.preferences]
  );
  const discoveryPreferences =
    preferencesQuery.preferences.restaurant_discovery;
  const [mode, setMode] = useState<DiscoverMode>('search');
  const [region, setRegion] = useState<Region>(initialRegion);
  const [searchRegion, setSearchRegion] = useState<Region>(initialRegion);
  const [hasPendingRegion, setHasPendingRegion] = useState(false);
  const [viewMode, setViewMode] = useState<RestaurantViewMode>(
    discoveryPreferences.preferred_view
  );
  const [cityQuery, setCityQuery] = useState(
    discoveryPreferences.last_city ?? ''
  );
  const [openNowOnly, setOpenNowOnly] = useState(
    discoveryPreferences.open_now
  );
  const [minRating, setMinRating] = useState<number | null>(
    discoveryPreferences.min_rating
  );
  const [radiusMeters, setRadiusMeters] = useState(
    discoveryPreferences.radius_meters
  );
  const [qualityMode, setQualityMode] = useState<RestaurantQualityMode>(
    discoveryPreferences.quality_mode
  );
  const [cuisineType, setCuisineType] = useState<string | null>(
    discoveryPreferences.cuisine_type
  );
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<RestaurantRecord | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [isAiSheetOpen, setIsAiSheetOpen] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const hasMapsKey = Boolean(env.GOOGLE_MAPS_IOS_KEY);
  const filters = useMemo(
    () => ({
      cuisineTypes: cuisineType ? [cuisineType] : undefined,
      minRating: minRating ?? undefined,
      openNow: openNowOnly,
      qualityMode,
      radiusMeters,
    }),
    [cuisineType, minRating, openNowOnly, qualityMode, radiusMeters]
  );
  const restaurantQuery = useRestaurantSearch({
    bounds: getBoundsFromRegion(searchRegion),
    center: getRegionCenter(searchRegion),
    filters,
  });
  const restaurants = useMemo(
    () => restaurantQuery.data?.data ?? [],
    [restaurantQuery.data?.data]
  );
  const savedRestaurantItems = useMemo(
    () =>
      (savedRestaurants.query.data ?? [])
        .map((item) => item.restaurant)
        .filter((restaurant): restaurant is RestaurantRecord =>
          Boolean(restaurant)
        ),
    [savedRestaurants.query.data]
  );
  const displayedRestaurants =
    mode === 'saved' ? savedRestaurantItems : restaurants;
  const mapPoints = useMemo(() => buildMapPoints(restaurants), [restaurants]);
  const source = restaurantQuery.data?.source ?? 'fallback';
  const activeFilterSummary = [
    openNowOnly ? 'Offen' : null,
    getQualityLabel(qualityMode),
    minRating ? `${String(minRating).replace('.', ',')}+` : null,
    getDistanceLabel(radiusMeters),
    cuisineType ? getCuisineLabel(cuisineType) : null,
  ].filter(Boolean);
  const hasCustomFilters =
    openNowOnly ||
    minRating !== null ||
    radiusMeters !== 5000 ||
    qualityMode !== 'smart' ||
    cuisineType !== null;
  const canUseAiRecommendation =
    mode === 'search' &&
    source === 'google_places' &&
    restaurants.length > 0 &&
    !restaurantQuery.isLoading;

  useFocusEffect(
    useCallback(() => {
      trackAdoptionEvent('discover_tab_opened', { feature: 'discover' });
    }, [])
  );

  useEffect(() => {
    const preferredView = normalizeRestaurantViewMode(params.preferredView);

    if (!preferredView) {
      return;
    }

    setSelectedRestaurant(null);
    setMode('search');

    if (preferredView === viewMode) {
      return;
    }

    setViewMode(preferredView);
  }, [params.preferredView, viewMode]);

  useEffect(() => {
    if (!selectedRestaurant) {
      return;
    }

    const isSelectedRestaurantVisible = restaurants.some(
      (restaurant) => restaurant.id === selectedRestaurant.id
    );

    if (!isSelectedRestaurantVisible) {
      setSelectedRestaurant(null);
    }
  }, [restaurants, selectedRestaurant]);

  function persistDiscoveryPreference(
    nextPreference: Partial<
      typeof discoveryPreferences
    >
  ) {
    void preferencesQuery
      .updatePreference('restaurant_discovery', {
        ...discoveryPreferences,
        cuisine_type: cuisineType,
        min_rating: minRating,
        open_now: openNowOnly,
        preferred_view: viewMode,
        quality_mode: qualityMode,
        radius_meters: radiusMeters,
        ...nextPreference,
      })
      .catch(() => undefined);
  }

  function updateRegion(nextRegion: Region, city?: string) {
    setRegion(nextRegion);
    setSearchRegion(nextRegion);
    setHasPendingRegion(false);
    setSelectedRestaurant(null);
    persistDiscoveryPreference({
      last_city:
        city ?? discoveryPreferences.last_city,
      last_map_center: {
        lat: nextRegion.latitude,
        lng: nextRegion.longitude,
      },
    });
  }

  async function requestLocation() {
    setIsRequestingLocation(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        showToast('Du kannst stattdessen eine Stadt eingeben.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextRegion = {
        latitude: position.coords.latitude,
        latitudeDelta: 0.08,
        longitude: position.coords.longitude,
        longitudeDelta: 0.08,
      };

      await Haptics.selectionAsync();
      updateRegion(nextRegion, cityQuery.trim() || undefined);
      mapRef.current?.animateToRegion(nextRegion, 350);
      setViewMode('map');
      setMode('search');
      persistDiscoveryPreference({ preferred_view: 'map' });
    } catch {
      Alert.alert(
        'Standort nicht verfügbar',
        'Bitte gib eine Stadt ein oder versuche es später erneut.'
      );
    } finally {
      setIsRequestingLocation(false);
    }
  }

  async function submitCitySearch() {
    const query = cityQuery.trim();

    if (query.length < 2) {
      showToast('Bitte gib eine Stadt ein.');
      return;
    }

    setIsSearchingCity(true);

    try {
      const result = await geocodeRestaurantCity(query);

      updateRegion(result.region, result.label);
      setCityQuery(result.label);
      setViewMode('map');
      setMode('search');
      trackAdoptionEvent('discover_search_executed', {
        feature: 'discover',
        tags: { city: sanitizeCityTag(result.label) },
      });
      persistDiscoveryPreference({
        last_city: result.label,
        preferred_view: 'map',
      });
      mapRef.current?.animateToRegion(result.region, 350);
    } catch {
      Alert.alert(
        'Stadt nicht gefunden',
        'Bitte prüfe die Eingabe oder nutze deinen Standort.'
      );
    } finally {
      setIsSearchingCity(false);
    }
  }

  function applyVisibleMapRegion() {
    setSearchRegion(region);
    setHasPendingRegion(false);
    setSelectedRestaurant(null);
    persistDiscoveryPreference({
      last_map_center: {
        lat: region.latitude,
        lng: region.longitude,
      },
    });
  }

  function switchViewMode(nextMode: RestaurantViewMode) {
    setSelectedRestaurant(null);
    setViewMode(nextMode);
    persistDiscoveryPreference({ preferred_view: nextMode });
  }

  function switchDiscoverMode(nextMode: DiscoverMode) {
    setSelectedRestaurant(null);
    setMode(nextMode);
  }

  function resetFilters() {
    setSelectedRestaurant(null);
    setOpenNowOnly(false);
    setMinRating(null);
    setRadiusMeters(5000);
    setQualityMode('smart');
    setCuisineType(null);
    persistDiscoveryPreference({
      cuisine_type: null,
      min_rating: null,
      open_now: false,
      quality_mode: 'smart',
      radius_meters: 5000,
    });
  }

  function updateOpenNowFilter(nextValue: boolean) {
    setSelectedRestaurant(null);
    setOpenNowOnly(nextValue);
    persistDiscoveryPreference({ open_now: nextValue });
  }

  function updateMinRatingFilter(nextValue: number | null) {
    setSelectedRestaurant(null);
    setMinRating(nextValue);
    persistDiscoveryPreference({ min_rating: nextValue });
  }

  function updateRadiusFilter(nextValue: number) {
    setSelectedRestaurant(null);
    setRadiusMeters(nextValue);
    persistDiscoveryPreference({ radius_meters: nextValue });
  }

  function updateQualityFilter(nextValue: RestaurantQualityMode) {
    setSelectedRestaurant(null);
    setQualityMode(nextValue);
    persistDiscoveryPreference({ quality_mode: nextValue });
  }

  function updateCuisineFilter(nextValue: string | null) {
    setSelectedRestaurant(null);
    setCuisineType(nextValue);
    persistDiscoveryPreference({ cuisine_type: nextValue });
  }

  async function toggleSaved(restaurant: RestaurantRecord) {
    try {
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

  async function runAiRecommendation(occasion: RestaurantAiOccasion) {
    if (!canUseAiRecommendation) {
      showToast(
        'KI-Empfehlung ist verfügbar, sobald echte Google-Daten geladen sind.'
      );
      return;
    }

    try {
      await Haptics.selectionAsync();
      trackAdoptionEvent('restaurant_ai_recommendation_requested', {
        feature: 'discover',
        tags: { entry: 'discover', occasion },
      });
      const contextLabel = [
        cityQuery.trim() || 'Aktuelle Karte',
        RESTAURANT_AI_OCCASION_LABELS[occasion],
        activeFilterSummary.join(' · '),
      ]
        .filter(Boolean)
        .join(' · ');
      const run = await analyzeRestaurantsMutation.mutateAsync({
        center: getRegionCenter(searchRegion),
        contextLabel,
        filters,
        occasion,
        restaurants,
      });

      setIsAiSheetOpen(false);
      router.push({
        pathname: '/restaurant-ai-results' as never,
        params: { runId: run.id },
      });
    } catch (error) {
      Alert.alert(
        'KI-Empfehlung nicht verfügbar',
        error instanceof Error
          ? error.message
          : 'Bitte versuche es später erneut.'
      );
    }
  }

  function startAiRecommendation(occasion: RestaurantAiOccasion) {
    requestAiAccess(() => runAiRecommendation(occasion));
  }

  function selectRestaurantMarker(restaurant: RestaurantRecord) {
    trackAdoptionEvent('restaurant_marker_tapped', { feature: 'discover' });
    setSelectedRestaurant(restaurant);
  }

  function openRestaurantDetail(restaurant: RestaurantRecord) {
    setSelectedRestaurant(null);
    router.push({
      pathname: '/restaurant-detail' as never,
      params: {
        centerLat: String(searchRegion.latitude),
        centerLng: String(searchRegion.longitude),
        provider: restaurant.provider,
        providerPlaceId: restaurant.providerPlaceId,
        restaurantId: restaurant.id,
        returnTo: 'discover',
        returnView: viewMode,
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

  function zoomIntoCluster(point: Extract<MapPoint, { type: 'cluster' }>) {
    const nextRegion = {
      latitude: point.coordinate.latitude,
      latitudeDelta: Math.max(region.latitudeDelta / 2, 0.02),
      longitude: point.coordinate.longitude,
      longitudeDelta: Math.max(region.longitudeDelta / 2, 0.02),
    };

    setSelectedRestaurant(null);
    setRegion(nextRegion);
    setSearchRegion(nextRegion);
    setHasPendingRegion(false);
    mapRef.current?.animateToRegion(nextRegion, 350);
  }

  function handleMapPress(event: MapPressEvent) {
    if (event.nativeEvent.action === 'marker-press') {
      return;
    }

    setSelectedRestaurant(null);
  }

  function renderMap() {
    if (!hasMapsKey) {
      return (
        <View style={styles.mapPlaceholder}>
          <View style={styles.mapPlaceholderIcon}>
            <Ionicons color={colors.primary} name="map-outline" size={28} />
          </View>
          <Text style={styles.mapPlaceholderTitle}>Google Maps vorbereiten</Text>
          <Text style={styles.mapPlaceholderText}>
            Für die echte Karte fehlt noch der iOS Maps Key im Build.
          </Text>
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        initialRegion={initialRegion}
        onPress={handleMapPress}
        onRegionChangeComplete={(nextRegion) => {
          setRegion(nextRegion);
          setHasPendingRegion(true);
        }}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
      >
        {mapPoints.map((point) => {
          if (point.type === 'cluster') {
            return (
              <Marker
                coordinate={point.coordinate}
                key={`cluster-${point.id}`}
                onPress={() => zoomIntoCluster(point)}
              >
                <View style={styles.clusterMarker}>
                  <Text style={styles.clusterMarkerText}>{point.count}</Text>
                </View>
              </Marker>
            );
          }

          const isSelected = selectedRestaurant?.id === point.restaurant.id;
          const markerColor = getQualityTone(point.restaurant, colors);

          return (
            <Marker
              coordinate={point.coordinate}
              key={point.restaurant.id}
              onPress={() => selectRestaurantMarker(point.restaurant)}
              tracksViewChanges={isSelected}
            >
              {isSelected ? (
                <View style={styles.selectedMarker}>
                  {point.restaurant.photoUrl ? (
                    <Image
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      source={{ uri: point.restaurant.photoUrl }}
                      style={styles.selectedMarkerImage}
                    />
                  ) : (
                    <View style={styles.selectedMarkerFallback}>
                      <Text style={styles.selectedMarkerInitial}>
                        {getRestaurantInitial(point.restaurant)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.selectedMarkerScore}>
                    <Text style={styles.selectedMarkerScoreText}>
                      {point.restaurant.qualityScore ?? formatRating(point.restaurant.rating)}
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.restaurantMarker,
                    { backgroundColor: markerColor },
                  ]}
                >
                  <Ionicons
                    color={colors.white}
                    name={
                      point.restaurant.wineProfile?.isFullWineProfile
                        ? 'wine-outline'
                        : 'restaurant'
                    }
                    size={15}
                  />
                </View>
              )}
            </Marker>
          );
        })}
      </MapView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Orte</Text>
          <Text style={styles.title}>Entdecken</Text>
        </View>
        <View style={styles.sourceBadge}>
          <Ionicons
            color={source === 'google_places' ? colors.success : colors.warning}
            name={source === 'google_places' ? 'checkmark-circle' : 'flask'}
            size={15}
          />
          <Text style={styles.sourceBadgeText}>
            {source === 'google_places' ? 'Google' : 'Testdaten'}
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchRow}>
          <Ionicons color={colors.textSecondary} name="search" size={20} />
          <TextInput
            autoCapitalize="words"
            onChangeText={setCityQuery}
            onSubmitEditing={() => void submitCitySearch()}
            placeholder="Stadt suchen"
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            style={styles.searchInput}
            value={cityQuery}
          />
          <Pressable
            accessibilityLabel="Stadt suchen"
            disabled={isSearchingCity}
            onPress={() => void submitCitySearch()}
            style={styles.searchAction}
          >
            {isSearchingCity ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons color={colors.white} name="arrow-forward" size={18} />
            )}
          </Pressable>
        </View>

        <View style={styles.segmentRow}>
          <SegmentButton
            active={mode === 'search'}
            icon="compass-outline"
            label="Entdecken"
            onPress={() => switchDiscoverMode('search')}
            styles={styles}
          />
          <SegmentButton
            active={mode === 'saved'}
            icon="heart-outline"
            label="Gemerkt"
            onPress={() => switchDiscoverMode('saved')}
            styles={styles}
          />
        </View>

        {mode === 'search' && (
          <>
            <View style={styles.actionRow}>
              <Pressable
                disabled={isRequestingLocation}
                onPress={requestLocation}
                style={styles.locationButton}
              >
                {isRequestingLocation ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Ionicons color={colors.primary} name="navigate" size={16} />
                )}
                <Text style={styles.locationButtonText}>Standort</Text>
              </Pressable>

              <View style={styles.viewToggle}>
                <ViewModeButton
                  active={viewMode === 'map'}
                  icon="map"
                  label="Karte"
                  onPress={() => switchViewMode('map')}
                  styles={styles}
                />
                <ViewModeButton
                  active={viewMode === 'list'}
                  icon="list"
                  label="Liste"
                  onPress={() => switchViewMode('list')}
                  styles={styles}
                />
              </View>
            </View>

            <View style={styles.filterBar}>
              <Pressable
                onPress={() => setIsFilterSheetOpen(true)}
                style={styles.filterSummaryButton}
              >
                <View style={styles.filterSummaryIcon}>
                  <Ionicons color={colors.primary} name="options" size={18} />
                </View>
                <View style={styles.filterSummaryCopy}>
                  <Text style={styles.filterSummaryTitle}>Filter</Text>
                  <Text numberOfLines={1} style={styles.filterSummaryText}>
                    {activeFilterSummary.join(' · ')}
                  </Text>
                </View>
                <Ionicons
                  color={colors.textSecondary}
                  name="chevron-down"
                  size={18}
                />
              </Pressable>
              {canUseAiRecommendation ? (
                <Pressable
                  accessibilityLabel="KI-Empfehlung öffnen"
                  onPress={() =>
                    requestAiAccess(() => setIsAiSheetOpen(true))
                  }
                  style={styles.aiCompactButton}
                >
                  <Ionicons color={colors.white} name="sparkles" size={17} />
                  <Text style={styles.aiCompactText}>KI</Text>
                </Pressable>
              ) : null}
            </View>

            {hasCustomFilters ? (
              <Pressable onPress={resetFilters} style={styles.quickResetButton}>
                <Ionicons color={colors.primary} name="refresh" size={15} />
                <Text style={styles.quickResetText}>Filter zurücksetzen</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      {mode === 'search' && viewMode === 'map' ? (
        <View style={styles.mapShell}>
          {renderMap()}
          {hasPendingRegion && (
            <Pressable
              onPress={applyVisibleMapRegion}
              style={styles.searchAreaButton}
            >
              <Ionicons color={colors.white} name="refresh" size={16} />
              <Text style={styles.searchAreaButtonText}>
                In diesem Bereich suchen
              </Text>
            </Pressable>
          )}
          {restaurantQuery.isFetching && (
            <View style={styles.mapLoading}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.mapLoadingText}>Restaurants laden</Text>
            </View>
          )}
          {!restaurantQuery.isLoading && restaurants.length === 0 ? (
            <View style={styles.mapEmptyCard}>
              <Text style={styles.mapEmptyTitle}>Keine Treffer im Bereich</Text>
              <Text style={styles.mapEmptyText}>
                {qualityMode === 'strict'
                  ? 'Die strenge Qualitätssuche findet hier gerade zu wenige starke Orte.'
                  : 'Suche in einem größeren Bereich oder passe die Filter an.'}
              </Text>
              <Pressable onPress={resetFilters} style={styles.mapEmptyButton}>
                <Text style={styles.mapEmptyButtonText}>Filter lockern</Text>
              </Pressable>
            </View>
          ) : null}
          {selectedRestaurant && (
            <RestaurantPreview
              isSaved={savedRestaurants.isSaved(selectedRestaurant)}
              onClose={() => setSelectedRestaurant(null)}
              onDetail={() => openRestaurantDetail(selectedRestaurant)}
              onNavigate={() => openNavigation(selectedRestaurant)}
              onSave={() => void toggleSaved(selectedRestaurant)}
              restaurant={selectedRestaurant}
              styles={styles}
            />
          )}
        </View>
      ) : (
        <RestaurantList
          emptyLabel={
            mode === 'saved'
              ? 'Noch keine Restaurants gemerkt'
              : 'Keine Restaurants gefunden'
          }
          emptyDescription={
            mode === 'saved'
              ? 'Markiere gute Orte mit dem Herz, dann findest du sie hier wieder.'
              : qualityMode === 'strict'
                ? 'Die strenge Qualitätssuche findet hier gerade zu wenige starke Treffer. Locke die Filter oder erhöhe den Umkreis.'
                : 'Versuche einen größeren Umkreis oder eine andere Küche.'
          }
          isLoading={
            mode === 'saved'
              ? savedRestaurants.query.isLoading
              : restaurantQuery.isLoading
          }
          onDetail={openRestaurantDetail}
          onNavigate={openNavigation}
          onResetFilters={mode === 'search' ? resetFilters : undefined}
          onSave={(restaurant) => void toggleSaved(restaurant)}
          restaurants={displayedRestaurants}
          savedRestaurants={savedRestaurants}
          styles={styles}
        />
      )}

      <AiOccasionModal
        isAnalyzing={analyzeRestaurantsMutation.isPending}
        isOpen={isAiSheetOpen}
        onClose={() => setIsAiSheetOpen(false)}
        onSelect={(occasion) => void startAiRecommendation(occasion)}
        restaurants={restaurants}
        styles={styles}
      />
      <AgeGateModal {...modalProps.ageGate} />
      <AiConsentModal {...modalProps.aiConsent} />
      <RestaurantFilterSheet
        cuisineType={cuisineType}
        isOpen={isFilterSheetOpen}
        minRating={minRating}
        onClose={() => setIsFilterSheetOpen(false)}
        onCuisineChange={updateCuisineFilter}
        onMinRatingChange={updateMinRatingFilter}
        onOpenNowChange={updateOpenNowFilter}
        onQualityChange={updateQualityFilter}
        onRadiusChange={updateRadiusFilter}
        onReset={resetFilters}
        openNowOnly={openNowOnly}
        qualityMode={qualityMode}
        radiusMeters={radiusMeters}
        styles={styles}
      />
    </SafeAreaView>
  );
}

function RestaurantFilterSheet({
  cuisineType,
  isOpen,
  minRating,
  onClose,
  onCuisineChange,
  onMinRatingChange,
  onOpenNowChange,
  onQualityChange,
  onRadiusChange,
  onReset,
  openNowOnly,
  qualityMode,
  radiusMeters,
  styles,
}: {
  cuisineType: string | null;
  isOpen: boolean;
  minRating: number | null;
  onClose: () => void;
  onCuisineChange: (value: string | null) => void;
  onMinRatingChange: (value: number | null) => void;
  onOpenNowChange: (value: boolean) => void;
  onQualityChange: (value: RestaurantQualityMode) => void;
  onRadiusChange: (value: number) => void;
  onReset: () => void;
  openNowOnly: boolean;
  qualityMode: RestaurantQualityMode;
  radiusMeters: number;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { colors } = useTheme();

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={isOpen}>
      <View style={styles.aiModalBackdrop}>
        <View style={styles.filterSheet}>
          <View style={styles.aiSheetHeader}>
            <View>
              <Text style={styles.aiSheetEyebrow}>Suche</Text>
              <Text style={styles.aiSheetTitle}>Verfeinern</Text>
            </View>
            <Pressable onPress={onClose} style={styles.aiCloseButton}>
              <Ionicons color={colors.text} name="close" size={22} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.filterSheetContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.filterSheetTopRow}>
              <Text style={styles.filterSheetHint}>
                Qualität und Umkreis bestimmen, was zuerst erscheint.
              </Text>
              <Pressable onPress={onReset} style={styles.filterResetButton}>
                <Text style={styles.filterResetText}>Reset</Text>
              </Pressable>
            </View>

            <FilterGroup title="Umkreis" styles={styles}>
              {DISTANCE_FILTERS.map((option) => (
                <FilterChoice
                  active={radiusMeters === option.value}
                  key={option.value}
                  label={option.label}
                  onPress={() => onRadiusChange(option.value)}
                  styles={styles}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Qualität" styles={styles}>
              {QUALITY_FILTERS.map((option) => (
                <FilterChoice
                  active={qualityMode === option.value}
                  key={option.value}
                  label={option.label}
                  onPress={() => onQualityChange(option.value)}
                  styles={styles}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Bewertung" styles={styles}>
              {RATING_FILTERS.map((option) => (
                <FilterChoice
                  active={minRating === option.value}
                  key={option.label}
                  label={option.label}
                  onPress={() => onMinRatingChange(option.value)}
                  styles={styles}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Küche" styles={styles}>
              {CUISINE_FILTERS.map((option) => (
                <FilterChoice
                  active={cuisineType === option.value}
                  key={option.label}
                  label={option.label}
                  onPress={() => onCuisineChange(option.value)}
                  styles={styles}
                />
              ))}
            </FilterGroup>

            <Pressable
              onPress={() => onOpenNowChange(!openNowOnly)}
              style={[
                styles.openNowSheetToggle,
                openNowOnly && styles.openNowSheetToggleActive,
              ]}
            >
              <View
                style={[
                  styles.openDot,
                  openNowOnly && { backgroundColor: colors.white },
                ]}
              />
              <Text
                style={[
                  styles.openNowSheetText,
                  openNowOnly && styles.openNowSheetTextActive,
                ]}
              >
                Nur aktuell geöffnete Restaurants
              </Text>
            </Pressable>

            <Pressable onPress={onClose} style={styles.filterApplyButton}>
              <Text style={styles.filterApplyText}>Anwenden</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function FilterGroup({
  children,
  styles,
  title,
}: {
  children: ReactNode;
  styles: ReturnType<typeof makeStyles>;
  title: string;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupTitle}>{title}</Text>
      <View style={styles.filterChoiceWrap}>{children}</View>
    </View>
  );
}

function FilterChoice({
  active,
  label,
  onPress,
  styles,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChoice, active && styles.filterChoiceActive]}
    >
      <Text style={[styles.filterChoiceText, active && styles.filterChoiceTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function AiOccasionModal({
  isAnalyzing,
  isOpen,
  onClose,
  onSelect,
  restaurants,
  styles,
}: {
  isAnalyzing: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (occasion: RestaurantAiOccasion) => void;
  restaurants: RestaurantRecord[];
  styles: ReturnType<typeof makeStyles>;
}) {
  const { colors } = useTheme();
  const previewRestaurants = restaurants.slice(0, 5);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={isOpen}>
      <View style={styles.aiModalBackdrop}>
        <View style={styles.aiSheet}>
          <View style={styles.aiSheetHeader}>
            <View>
              <Text style={styles.aiSheetEyebrow}>Concierge</Text>
              <Text style={styles.aiSheetTitle}>Was suchst du heute?</Text>
            </View>
            <Pressable
              disabled={isAnalyzing}
              onPress={onClose}
              style={styles.aiCloseButton}
            >
              <Ionicons color={colors.text} name="close" size={22} />
            </Pressable>
          </View>

          {isAnalyzing ? (
            <View style={styles.aiAnalyzingState}>
              <View style={styles.aiPhotoCollage}>
                {previewRestaurants.map((restaurant, index) => (
                  <View
                    key={restaurant.id}
                    style={[
                      styles.aiPhotoTile,
                      index === 0 && styles.aiPhotoTileLarge,
                    ]}
                  >
                    {restaurant.photoUrl ? (
                      <Image
                        cachePolicy="memory-disk"
                        contentFit="cover"
                        source={{ uri: restaurant.photoUrl }}
                        style={styles.aiPhoto}
                      />
                    ) : (
                      <Text style={styles.aiPhotoInitial}>
                        {restaurant.name.slice(0, 1)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
              <View style={styles.aiStatusStack}>
                {[
                  'Bewertungen lesen',
                  'Wein-Fit prüfen',
                  'Top-Auswahl kuratieren',
                ].map((label) => (
                  <View key={label} style={styles.aiStatusRow}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.aiStatusText}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.aiOccasionGrid}>
              {AI_OCCASIONS.map((occasion) => (
                <Pressable
                  key={occasion.value}
                  onPress={() => onSelect(occasion.value)}
                  style={styles.aiOccasionCard}
                >
                  <View style={styles.aiOccasionIcon}>
                    <Ionicons
                      color={colors.primary}
                      name={occasion.icon}
                      size={22}
                    />
                  </View>
                  <View style={styles.aiOccasionBody}>
                    <Text style={styles.aiOccasionTitle}>
                      {RESTAURANT_AI_OCCASION_LABELS[occasion.value]}
                    </Text>
                    <Text style={styles.aiOccasionDescription}>
                      {occasion.description}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SegmentButton({
  active,
  icon,
  label,
  onPress,
  styles,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Ionicons
        name={icon}
        size={15}
        style={[styles.segmentIcon, active && styles.segmentIconActive]}
      />
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ViewModeButton({
  active,
  icon,
  label,
  onPress,
  styles,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.viewToggleOption, active && styles.viewToggleOptionActive]}
    >
      <Ionicons
        name={icon}
        size={15}
        style={[styles.viewToggleIcon, active && styles.viewToggleIconActive]}
      />
      <Text style={[styles.viewToggleText, active && styles.viewToggleTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function RestaurantList({
  emptyDescription,
  emptyLabel,
  isLoading,
  onDetail,
  onNavigate,
  onResetFilters,
  onSave,
  restaurants,
  savedRestaurants,
  styles,
}: {
  emptyDescription: string;
  emptyLabel: string;
  isLoading: boolean;
  onDetail: (restaurant: RestaurantRecord) => void;
  onNavigate: (restaurant: RestaurantRecord) => void;
  onResetFilters?: () => void;
  onSave: (restaurant: RestaurantRecord) => void;
  restaurants: RestaurantRecord[];
  savedRestaurants: ReturnType<typeof useSavedRestaurants>;
  styles: ReturnType<typeof makeStyles>;
}) {
  if (isLoading) {
    return (
      <View style={styles.listLoading}>
        <ActivityIndicator />
      </View>
    );
  }

  if (restaurants.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="restaurant-outline" size={30} style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>{emptyLabel}</Text>
        <Text style={styles.emptyText}>{emptyDescription}</Text>
        {onResetFilters ? (
          <Pressable onPress={onResetFilters} style={styles.emptyAction}>
            <Text style={styles.emptyActionText}>Filter lockern</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      {restaurants.map((restaurant) => (
        <RestaurantCard
          isSaved={savedRestaurants.isSaved(restaurant)}
          key={`${restaurant.provider}:${restaurant.providerPlaceId}`}
          onDetail={() => onDetail(restaurant)}
          onNavigate={() => onNavigate(restaurant)}
          onPress={() => onDetail(restaurant)}
          onSave={() => onSave(restaurant)}
          restaurant={restaurant}
          styles={styles}
        />
      ))}
    </ScrollView>
  );
}

type RestaurantCardProps = {
  isSaved: boolean;
  onDetail: () => void;
  onNavigate: () => void;
  onPress?: () => void;
  onSave: () => void;
  restaurant: RestaurantRecord;
  styles: ReturnType<typeof makeStyles>;
};

function RestaurantCard({
  isSaved,
  onDetail,
  onNavigate,
  onPress,
  onSave,
  restaurant,
  styles,
}: RestaurantCardProps) {
  const distance = formatDistance(restaurant.distanceMeters);

  return (
    <Pressable onPress={onPress} style={styles.restaurantCard}>
      <View style={styles.restaurantImageWrap}>
        {restaurant.photoUrl ? (
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: restaurant.photoUrl }}
            style={styles.restaurantImage}
          />
        ) : (
          <RestaurantImageFallback restaurant={restaurant} styles={styles} />
        )}
      </View>
      <View style={styles.restaurantInfo}>
        <View style={styles.restaurantTitleRow}>
          <Text numberOfLines={2} style={styles.restaurantName}>
            {restaurant.name}
          </Text>
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={13} style={styles.ratingIcon} />
            <Text style={styles.ratingText}>{formatRating(restaurant.rating)}</Text>
          </View>
        </View>
        <WineIndicatorBadge profile={restaurant.wineProfile} />
        <Text numberOfLines={1} style={styles.restaurantMeta}>
          {[restaurant.cuisine, distance, getPriceLabel(restaurant.priceLevel)]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {restaurant.qualityLabel ? (
          <View style={styles.qualityInline}>
            <Ionicons name="checkmark-circle" size={14} style={styles.qualityIcon} />
            <Text numberOfLines={1} style={styles.qualityText}>
              {restaurant.qualityLabel}
              {restaurant.qualityScore ? ` · ${restaurant.qualityScore}` : ''}
            </Text>
          </View>
        ) : null}
        <Text numberOfLines={1} style={styles.restaurantAddress}>
          {restaurant.address ?? 'Adresse wird geladen'}
        </Text>
        <View style={styles.restaurantActions}>
          <Pressable
            onPress={(event: GestureResponderEvent) => {
              event.stopPropagation();
              onSave();
            }}
            style={styles.secondaryAction}
          >
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={16} />
            <Text style={styles.secondaryActionText}>
              {isSaved ? 'Gemerkt' : 'Merken'}
            </Text>
          </Pressable>
          <Pressable
            onPress={(event: GestureResponderEvent) => {
              event.stopPropagation();
              onDetail();
            }}
            style={styles.secondaryAction}
          >
            <Ionicons name="information-circle-outline" size={16} />
            <Text style={styles.secondaryActionText}>Details</Text>
          </Pressable>
          <Pressable
            onPress={(event: GestureResponderEvent) => {
              event.stopPropagation();
              onNavigate();
            }}
            style={styles.primaryAction}
          >
            <Ionicons name="navigate" size={16} />
            <Text style={styles.primaryActionText}>Route</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function RestaurantImageFallback({
  restaurant,
  styles,
}: {
  restaurant: RestaurantRecord;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.restaurantImageFallback}>
      <Text style={styles.restaurantImageInitial}>
        {getRestaurantInitial(restaurant)}
      </Text>
      <Text numberOfLines={1} style={styles.restaurantImageCuisine}>
        {restaurant.cuisine ?? 'Ort'}
      </Text>
    </View>
  );
}

type RestaurantPreviewProps = RestaurantCardProps & {
  onClose: () => void;
};

function RestaurantPreview({ onClose, ...cardProps }: RestaurantPreviewProps) {
  return (
    <View style={cardProps.styles.previewCard}>
      <Pressable
        accessibilityLabel="Restaurant-Vorschau schließen"
        accessibilityRole="button"
        onPress={(event: GestureResponderEvent) => {
          event.stopPropagation();
          onClose();
        }}
        style={cardProps.styles.previewCloseButton}
      >
        <Ionicons
          name="close"
          size={20}
          style={cardProps.styles.previewCloseIcon}
        />
      </Pressable>
      <RestaurantCard {...cardProps} onPress={cardProps.onDetail} />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between',
    },
    aiAnalyzingState: {
      gap: spacing.lg,
    },
    aiCloseButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    aiModalBackdrop: {
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: 'flex-end',
    },
    aiOccasionBody: {
      flex: 1,
      gap: spacing.xs,
    },
    aiOccasionCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
    },
    aiOccasionDescription: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
    },
    aiOccasionGrid: {
      gap: spacing.sm,
    },
    aiOccasionIcon: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderRadius: radii.md,
      height: 46,
      justifyContent: 'center',
      width: 46,
    },
    aiOccasionTitle: {
      color: colors.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.black,
    },
    aiPhoto: {
      height: '100%',
      width: '100%',
    },
    aiPhotoCollage: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    aiPhotoInitial: {
      color: colors.white,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
    },
    aiPhotoTile: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      height: 74,
      justifyContent: 'center',
      overflow: 'hidden',
      width: 74,
    },
    aiPhotoTileLarge: {
      height: 112,
      width: 112,
    },
    aiCompactButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: 44,
      paddingHorizontal: spacing.md,
    },
    aiCompactText: {
      color: colors.white,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.black,
    },
    aiRecommendationButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    aiRecommendationIcon: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    aiRecommendationText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
    },
    aiRecommendationTextWrap: {
      flex: 1,
      gap: spacing.xs,
    },
    aiRecommendationTitle: {
      color: colors.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.black,
    },
    aiSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      gap: spacing.lg,
      maxHeight: '88%',
      padding: spacing.xl,
    },
    aiSheetEyebrow: {
      color: colors.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.extraBold,
      textTransform: 'uppercase',
    },
    aiSheetHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    aiSheetTitle: {
      color: colors.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
    },
    aiStatusRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    aiStatusStack: {
      gap: spacing.sm,
    },
    aiStatusText: {
      color: colors.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    clusterMarker: {
      alignItems: 'center',
      backgroundColor: colors.primaryDark,
      borderColor: colors.white,
      borderRadius: 22,
      borderWidth: 2,
      height: 44,
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      width: 44,
    },
    clusterMarkerText: {
      color: colors.white,
      fontSize: typography.size.md,
      fontWeight: typography.weight.extraBold,
    },
    controls: {
      gap: spacing.xs,
      paddingHorizontal: spacing.screenX,
      paddingBottom: spacing.xs,
      paddingTop: spacing.xs,
    },
    emptyAction: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      minHeight: 42,
      justifyContent: 'center',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    emptyActionText: {
      color: colors.white,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.black,
    },
    emptyIcon: {
      color: colors.primary,
    },
    emptyState: {
      alignItems: 'center',
      flex: 1,
      gap: spacing.sm,
      justifyContent: 'center',
      padding: spacing.xxl,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.black,
      textAlign: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.size.md,
      lineHeight: typography.lineHeight.md,
      textAlign: 'center',
    },
    eyebrow: {
      color: colors.primaryDark,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.extraBold,
      textTransform: 'uppercase',
    },
    filterChip: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 38,
      paddingHorizontal: spacing.md,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    filterChipTextActive: {
      color: colors.white,
    },
    filterApplyButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      justifyContent: 'center',
      minHeight: 48,
    },
    filterApplyText: {
      color: colors.white,
      fontSize: typography.size.md,
      fontWeight: typography.weight.black,
    },
    filterBar: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    filterChoice: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      minHeight: 38,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    filterChoiceActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChoiceText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    filterChoiceTextActive: {
      color: colors.white,
    },
    filterChoiceWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    filterContent: {
      gap: spacing.sm,
      paddingRight: spacing.screenX,
    },
    filterGroup: {
      gap: spacing.sm,
    },
    filterGroupTitle: {
      color: colors.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.black,
      textTransform: 'uppercase',
    },
    filterResetButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    filterResetText: {
      color: colors.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    filterSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      gap: spacing.lg,
      maxHeight: '88%',
      padding: spacing.xl,
    },
    filterSheetContent: {
      gap: spacing.lg,
    },
    filterSheetHint: {
      color: colors.textSecondary,
      flex: 1,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
    },
    filterSheetTopRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    filterSummaryButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 46,
      paddingHorizontal: spacing.md,
    },
    filterSummaryCopy: {
      flex: 1,
      gap: 2,
    },
    filterSummaryIcon: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderRadius: radii.md,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    filterSummaryText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    filterSummaryTitle: {
      color: colors.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.black,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.screenX,
      paddingTop: spacing.sm,
    },
    listContent: {
      gap: spacing.md,
      paddingBottom: 120,
      paddingHorizontal: spacing.screenX,
    },
    listLoading: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    locationButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 42,
      paddingHorizontal: spacing.md,
    },
    locationButtonText: {
      color: colors.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    map: {
      flex: 1,
    },
    mapEmptyButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    mapEmptyButtonText: {
      color: colors.white,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.black,
    },
    mapEmptyCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.sm,
      left: spacing.md,
      padding: spacing.md,
      position: 'absolute',
      right: spacing.md,
      top: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    mapEmptyText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
    },
    mapEmptyTitle: {
      color: colors.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.black,
    },
    mapLoading: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      position: 'absolute',
      top: spacing.md,
    },
    mapLoadingText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    mapPlaceholder: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      flex: 1,
      gap: spacing.md,
      justifyContent: 'center',
      padding: spacing.xxl,
    },
    mapPlaceholderIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      height: 58,
      justifyContent: 'center',
      width: 58,
    },
    mapPlaceholderText: {
      color: colors.textSecondary,
      fontSize: typography.size.md,
      lineHeight: typography.lineHeight.base,
      textAlign: 'center',
    },
    mapPlaceholderTitle: {
      color: colors.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
    },
    mapShell: {
      backgroundColor: colors.surfaceWarm,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flex: 1,
      overflow: 'hidden',
    },
    openDot: {
      backgroundColor: colors.success,
      borderRadius: 5,
      height: 10,
      width: 10,
    },
    openNowSheetText: {
      color: colors.text,
      flex: 1,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    openNowSheetTextActive: {
      color: colors.white,
    },
    openNowSheetToggle: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 50,
      paddingHorizontal: spacing.md,
    },
    openNowSheetToggleActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    previewCard: {
      bottom: spacing.md,
      left: spacing.md,
      position: 'absolute',
      right: spacing.md,
    },
    previewCloseButton: {
      alignItems: 'center',
      alignSelf: 'flex-end',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      marginBottom: spacing.xs,
      shadowColor: colors.shadow,
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      width: 40,
    },
    previewCloseIcon: {
      color: colors.text,
    },
    primaryAction: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    primaryActionText: {
      color: colors.white,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    ratingIcon: {
      color: colors.primary,
    },
    ratingPill: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    ratingText: {
      color: colors.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.extraBold,
    },
    qualityIcon: {
      color: colors.success,
    },
    qualityInline: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
    },
    qualityText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    quickResetButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
    },
    quickResetText: {
      color: colors.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    resetChip: {
      alignItems: 'center',
      borderColor: colors.primary,
      borderRadius: radii.pill,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 38,
      paddingHorizontal: spacing.md,
    },
    resetChipText: {
      color: colors.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    resetIconButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      height: 46,
      justifyContent: 'center',
      width: 46,
    },
    restaurantActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    restaurantAddress: {
      color: colors.placeholder,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
    },
    restaurantCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
    },
    restaurantImage: {
      height: '100%',
      width: '100%',
    },
    restaurantImageFallback: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      flex: 1,
      gap: spacing.xs,
      justifyContent: 'center',
      padding: spacing.xs,
    },
    restaurantImageCuisine: {
      color: colors.textSecondary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
      textAlign: 'center',
    },
    restaurantImageIcon: {
      color: colors.primary,
    },
    restaurantImageInitial: {
      color: colors.primary,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
    },
    restaurantImageWrap: {
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      height: 82,
      overflow: 'hidden',
      width: 82,
    },
    restaurantInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    restaurantMarker: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderColor: colors.white,
      borderRadius: 18,
      borderWidth: 2,
      height: 36,
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      width: 36,
    },
    restaurantMarkerClosed: {
      backgroundColor: colors.textSecondary,
    },
    restaurantMarkerSelected: {
      backgroundColor: colors.primaryDark,
      transform: [{ scale: 1.12 }],
    },
    restaurantMeta: {
      color: colors.textSecondary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.md,
    },
    restaurantName: {
      color: colors.text,
      flex: 1,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.black,
      lineHeight: typography.lineHeight.lg,
    },
    restaurantTitleRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    searchAction: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    searchAreaButton: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      position: 'absolute',
      top: spacing.md,
    },
    searchAreaButtonText: {
      color: colors.white,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    searchInput: {
      color: colors.text,
      flex: 1,
      fontSize: typography.size.base,
      fontWeight: typography.weight.bold,
      minHeight: 42,
    },
    searchRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
    },
    secondaryAction: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    secondaryActionText: {
      color: colors.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    selectedMarker: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.white,
      borderRadius: radii.md,
      borderWidth: 2,
      height: 50,
      justifyContent: 'center',
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { height: 5, width: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      width: 50,
    },
    selectedMarkerImage: {
      height: '100%',
      width: '100%',
    },
    selectedMarkerFallback: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      height: '100%',
      justifyContent: 'center',
      width: '100%',
    },
    selectedMarkerInitial: {
      color: colors.primary,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.black,
    },
    selectedMarkerScore: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      bottom: 3,
      minWidth: 26,
      paddingHorizontal: 5,
      paddingVertical: 1,
      position: 'absolute',
      right: 3,
    },
    selectedMarkerScoreText: {
      color: colors.white,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.black,
    },
    segmentButton: {
      alignItems: 'center',
      borderRadius: radii.pill,
      flex: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      justifyContent: 'center',
      minHeight: 40,
    },
    segmentButtonActive: {
      backgroundColor: colors.primary,
    },
    segmentIcon: {
      color: colors.textSecondary,
    },
    segmentIconActive: {
      color: colors.white,
    },
    segmentRow: {
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      padding: spacing.xs,
    },
    segmentText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    segmentTextActive: {
      color: colors.white,
    },
    sourceBadge: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      opacity: 0.86,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    sourceBadgeText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    title: {
      color: colors.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
      lineHeight: typography.lineHeight.xl,
    },
    viewToggle: {
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      padding: spacing.xs,
    },
    viewToggleIcon: {
      color: colors.textSecondary,
    },
    viewToggleIconActive: {
      color: colors.white,
    },
    viewToggleOption: {
      alignItems: 'center',
      borderRadius: radii.pill,
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    viewToggleOptionActive: {
      backgroundColor: colors.primary,
    },
    viewToggleText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    viewToggleTextActive: {
      color: colors.white,
    },
  });
}
