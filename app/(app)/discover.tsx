import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
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
  type Region,
} from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePreferences } from '@/hooks/usePreferences';
import { useAnalyzeRestaurants } from '@/hooks/useRestaurantAi';
import { useRestaurantSearch } from '@/hooks/useRestaurantSearch';
import { useSavedRestaurants } from '@/hooks/useSavedRestaurants';
import { env } from '@/lib/env';
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
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const preferencesQuery = usePreferences();
  const analyzeRestaurantsMutation = useAnalyzeRestaurants();
  const savedRestaurants = useSavedRestaurants();
  const showToast = useToastStore((state) => state.showToast);
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
  const [cuisineType, setCuisineType] = useState<string | null>(
    discoveryPreferences.cuisine_type
  );
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<RestaurantRecord | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [isAiSheetOpen, setIsAiSheetOpen] = useState(false);
  const hasMapsKey = Boolean(env.GOOGLE_MAPS_IOS_KEY);
  const filters = useMemo(
    () => ({
      cuisineTypes: cuisineType ? [cuisineType] : undefined,
      minRating: minRating ?? undefined,
      openNow: openNowOnly,
      radiusMeters,
    }),
    [cuisineType, minRating, openNowOnly, radiusMeters]
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
    minRating ? `${String(minRating).replace('.', ',')}+` : null,
    DISTANCE_FILTERS.find((option) => option.value === radiusMeters)?.label,
    CUISINE_FILTERS.find((option) => option.value === cuisineType)?.label,
  ].filter(Boolean);
  const canUseAiRecommendation =
    mode === 'search' &&
    source === 'google_places' &&
    restaurants.length > 0 &&
    !restaurantQuery.isLoading;

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
    setViewMode(nextMode);
    persistDiscoveryPreference({ preferred_view: nextMode });
  }

  function resetFilters() {
    setOpenNowOnly(false);
    setMinRating(null);
    setRadiusMeters(5000);
    setCuisineType(null);
    persistDiscoveryPreference({
      cuisine_type: null,
      min_rating: null,
      open_now: false,
      radius_meters: 5000,
    });
  }

  function updateOpenNowFilter(nextValue: boolean) {
    setOpenNowOnly(nextValue);
    persistDiscoveryPreference({ open_now: nextValue });
  }

  function updateMinRatingFilter(nextValue: number | null) {
    setMinRating(nextValue);
    persistDiscoveryPreference({ min_rating: nextValue });
  }

  function updateRadiusFilter(nextValue: number) {
    setRadiusMeters(nextValue);
    persistDiscoveryPreference({ radius_meters: nextValue });
  }

  function updateCuisineFilter(nextValue: string | null) {
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
        showToast('Restaurant gemerkt');
      }
    } catch {
      showToast('Restaurant konnte nicht gespeichert werden.');
    }
  }

  async function startAiRecommendation(occasion: RestaurantAiOccasion) {
    if (!canUseAiRecommendation) {
      showToast(
        'KI-Empfehlung ist verfügbar, sobald echte Google-Daten geladen sind.'
      );
      return;
    }

    try {
      await Haptics.selectionAsync();
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

  function openRestaurantDetail(restaurant: RestaurantRecord) {
    router.push({
      pathname: '/restaurant-detail' as never,
      params: {
        centerLat: String(searchRegion.latitude),
        centerLng: String(searchRegion.longitude),
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

          return (
            <Marker
              coordinate={point.coordinate}
              key={point.restaurant.id}
              onPress={() => setSelectedRestaurant(point.restaurant)}
              tracksViewChanges={false}
            >
              <View
                style={[
                  styles.restaurantMarker,
                  point.restaurant.isOpenNow === false &&
                    styles.restaurantMarkerClosed,
                  isSelected && styles.restaurantMarkerSelected,
                ]}
              >
                <Ionicons color={colors.white} name="restaurant" size={15} />
              </View>
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
            onPress={() => setMode('search')}
            styles={styles}
          />
          <SegmentButton
            active={mode === 'saved'}
            icon="heart-outline"
            label="Gemerkt"
            onPress={() => setMode('saved')}
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

            <ScrollView
              contentContainerStyle={styles.filterContent}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <Pressable
                onPress={() => updateOpenNowFilter(!openNowOnly)}
                style={[
                  styles.filterChip,
                  openNowOnly && styles.filterChipActive,
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
                    styles.filterChipText,
                    openNowOnly && styles.filterChipTextActive,
                  ]}
                >
                  Jetzt offen
                </Text>
              </Pressable>
              {RATING_FILTERS.map((option) => (
                <FilterChip
                  active={minRating === option.value}
                  key={`rating-${option.label}`}
                  label={option.label}
                  onPress={() => updateMinRatingFilter(option.value)}
                  styles={styles}
                />
              ))}
              {DISTANCE_FILTERS.map((option) => (
                <FilterChip
                  active={radiusMeters === option.value}
                  key={`distance-${option.value}`}
                  label={option.label}
                  onPress={() => updateRadiusFilter(option.value)}
                  styles={styles}
                />
              ))}
              {CUISINE_FILTERS.map((option) => (
                <FilterChip
                  active={cuisineType === option.value}
                  key={`cuisine-${option.label}`}
                  label={option.label}
                  onPress={() => updateCuisineFilter(option.value)}
                  styles={styles}
                />
              ))}
              {activeFilterSummary.length > 1 && (
                <Pressable onPress={resetFilters} style={styles.resetChip}>
                  <Text style={styles.resetChipText}>Zurücksetzen</Text>
                </Pressable>
              )}
            </ScrollView>

            {canUseAiRecommendation ? (
              <Pressable
                onPress={() => setIsAiSheetOpen(true)}
                style={styles.aiRecommendationButton}
              >
                <View style={styles.aiRecommendationIcon}>
                  <Ionicons color={colors.white} name="sparkles" size={18} />
                </View>
                <View style={styles.aiRecommendationTextWrap}>
                  <Text style={styles.aiRecommendationTitle}>
                    KI-Empfehlung
                  </Text>
                  <Text numberOfLines={1} style={styles.aiRecommendationText}>
                    Top-Auswahl mit Begründung kuratieren
                  </Text>
                </View>
                <Ionicons
                  color={colors.primary}
                  name="chevron-forward"
                  size={20}
                />
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
          {selectedRestaurant && (
            <RestaurantPreview
              isSaved={savedRestaurants.isSaved(selectedRestaurant)}
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
          isLoading={
            mode === 'saved'
              ? savedRestaurants.query.isLoading
              : restaurantQuery.isLoading
          }
          onDetail={openRestaurantDetail}
          onNavigate={openNavigation}
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
    </SafeAreaView>
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

function FilterChip({
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
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function RestaurantList({
  emptyLabel,
  isLoading,
  onDetail,
  onNavigate,
  onSave,
  restaurants,
  savedRestaurants,
  styles,
}: {
  emptyLabel: string;
  isLoading: boolean;
  onDetail: (restaurant: RestaurantRecord) => void;
  onNavigate: (restaurant: RestaurantRecord) => void;
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
          <View style={styles.restaurantImageFallback}>
            <Ionicons name="wine" size={24} style={styles.restaurantImageIcon} />
          </View>
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
        <Text numberOfLines={1} style={styles.restaurantMeta}>
          {[restaurant.cuisine, distance, getPriceLabel(restaurant.priceLevel)]
            .filter(Boolean)
            .join(' · ')}
        </Text>
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

function RestaurantPreview(props: RestaurantCardProps) {
  return (
    <View style={props.styles.previewCard}>
      <RestaurantCard {...props} onPress={props.onDetail} />
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
      gap: spacing.sm,
      paddingHorizontal: spacing.screenX,
      paddingVertical: spacing.md,
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
    filterContent: {
      gap: spacing.sm,
      paddingRight: spacing.screenX,
    },
    header: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.screenX,
      paddingTop: spacing.md,
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
    previewCard: {
      bottom: spacing.lg,
      left: spacing.md,
      position: 'absolute',
      right: spacing.md,
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
      justifyContent: 'center',
    },
    restaurantImageIcon: {
      color: colors.primary,
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
      minHeight: 46,
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
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    sourceBadgeText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    title: {
      color: colors.text,
      fontSize: typography.size.brand,
      fontWeight: typography.weight.black,
      lineHeight: typography.lineHeight.brand,
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
