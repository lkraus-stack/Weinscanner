import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Tables } from '@/types/database';
import type {
  AnalyzeRestaurantsInput,
  Coordinates,
  GeocodedCity,
  RestaurantAiConfidence,
  RestaurantAiOccasion,
  RestaurantAiRecommendation,
  RestaurantAiRoleLabel,
  RestaurantDetailInput,
  RestaurantRatingRecord,
  RestaurantBounds,
  RestaurantMapRegion,
  RestaurantRecord,
  RestaurantRecommendationRun,
  RestaurantSearchInput,
  RestaurantSearchResult,
  RestaurantVisitListItem,
  RestaurantVisitRecord,
  SavedRestaurantRecord,
} from '@/types/restaurant';

export const MUNICH_CENTER: Coordinates = {
  lat: 48.137154,
  lng: 11.576124,
};

export const DEFAULT_RESTAURANT_REGION: RestaurantMapRegion = {
  latitude: MUNICH_CENTER.lat,
  latitudeDelta: 0.08,
  longitude: MUNICH_CENTER.lng,
  longitudeDelta: 0.08,
};

const FALLBACK_RESTAURANTS: RestaurantRecord[] = [
  {
    address: 'Viktualienmarkt 15, 80331 München',
    cuisine: 'Bayerisch, Weinbar',
    distanceMeters: 420,
    googleMapsUri: 'https://www.google.com/maps/search/?api=1&query=Viktualienmarkt%20M%C3%BCnchen',
    id: 'fallback-viktualienmarkt',
    isOpenNow: true,
    location: { lat: 48.13503, lng: 11.57628 },
    name: 'Weinort am Viktualienmarkt',
    openingHoursText: [],
    phone: null,
    photoRefs: [],
    photoUrl: null,
    priceLevel: 'Mittel',
    provider: 'fallback',
    providerPlaceId: 'fallback-viktualienmarkt',
    rating: 4.6,
    ratingCount: 312,
    source: 'fallback',
    types: ['restaurant', 'wine_bar'],
    websiteUrl: null,
  },
  {
    address: 'Prannerstraße 11, 80333 München',
    cuisine: 'Modern, Fine Dining',
    distanceMeters: 780,
    googleMapsUri: 'https://www.google.com/maps/search/?api=1&query=Prannerstra%C3%9Fe%2011%20M%C3%BCnchen',
    id: 'fallback-prannerstrasse',
    isOpenNow: true,
    location: { lat: 48.14023, lng: 11.57202 },
    name: 'Pranner Wein Küche',
    openingHoursText: [],
    phone: null,
    photoRefs: [],
    photoUrl: null,
    priceLevel: 'Gehoben',
    provider: 'fallback',
    providerPlaceId: 'fallback-prannerstrasse',
    rating: 4.7,
    ratingCount: 188,
    source: 'fallback',
    types: ['restaurant', 'fine_dining_restaurant'],
    websiteUrl: null,
  },
  {
    address: 'Schellingstraße 48, 80799 München',
    cuisine: 'Italienisch, Wein',
    distanceMeters: 1650,
    googleMapsUri: 'https://www.google.com/maps/search/?api=1&query=Schellingstra%C3%9Fe%2048%20M%C3%BCnchen',
    id: 'fallback-schellingstrasse',
    isOpenNow: false,
    location: { lat: 48.15036, lng: 11.58047 },
    name: 'Schelling Vinoteca',
    openingHoursText: [],
    phone: null,
    photoRefs: [],
    photoUrl: null,
    priceLevel: 'Mittel',
    provider: 'fallback',
    providerPlaceId: 'fallback-schellingstrasse',
    rating: 4.4,
    ratingCount: 96,
    source: 'fallback',
    types: ['restaurant', 'italian_restaurant'],
    websiteUrl: null,
  },
  {
    address: 'Gärtnerplatz 3, 80469 München',
    cuisine: 'Mediterran',
    distanceMeters: 980,
    googleMapsUri: 'https://www.google.com/maps/search/?api=1&query=G%C3%A4rtnerplatz%203%20M%C3%BCnchen',
    id: 'fallback-gaertnerplatz',
    isOpenNow: true,
    location: { lat: 48.1318, lng: 11.57593 },
    name: 'Gärtnerplatz Genuss',
    openingHoursText: [],
    phone: null,
    photoRefs: [],
    photoUrl: null,
    priceLevel: 'Mittel',
    provider: 'fallback',
    providerPlaceId: 'fallback-gaertnerplatz',
    rating: 4.5,
    ratingCount: 244,
    source: 'fallback',
    types: ['restaurant', 'mediterranean_restaurant'],
    websiteUrl: null,
  },
];

type RestaurantTableRow = Tables<'restaurants'>;
type SavedRestaurantRow = Tables<'saved_restaurants'> & {
  restaurant: RestaurantTableRow | null;
};

type RestaurantVisitRow = Tables<'restaurant_visits'> & {
  inventory_item:
    | {
        vintage:
          | {
              vintage_year: number;
              wine:
                | {
                    producer: string;
                    wine_name: string;
                  }
                | null;
            }
          | null;
      }
    | null;
};

type RestaurantAiAnalysisRow = Tables<'restaurant_ai_analyses'> & {
  restaurant: RestaurantTableRow | null;
};

type RestaurantRecommendationRunRow = Tables<'restaurant_recommendation_runs'>;

export type RestaurantRatingInput = {
  notes?: string;
  overallStars: number;
  restaurant: RestaurantRecord;
  visitedAt?: string | null;
  wineStars: number;
};

export type RestaurantVisitInput = {
  inventoryItemId?: string | null;
  notes?: string | null;
  restaurant: RestaurantRecord;
  visitedAt: string;
  vintageId?: string | null;
};

export const RESTAURANT_AI_OCCASION_LABELS: Record<
  RestaurantAiOccasion,
  string
> = {
  nice_evening: 'Schöner Abend',
  quick_bite: 'Schnelles Essen',
  special_experience: 'Besonderes Erlebnis',
  travel: 'Reise',
  wine_focus: 'Weinfokus',
};

const RESTAURANT_AI_ROLE_LABELS = new Set<RestaurantAiRoleLabel>([
  'Beste Wahl',
  'Beste Wein-Option',
  'Besonderes Erlebnis',
  'Preis-Leistung',
  'Sichere Wahl',
]);

const RESTAURANT_AI_CONFIDENCE = new Set<RestaurantAiConfidence>([
  'high',
  'low',
  'medium',
]);

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getDistanceMeters(from: Coordinates, to: Coordinates) {
  const earthRadiusMeters = 6371000;
  const latDelta = degreesToRadians(to.lat - from.lat);
  const lngDelta = degreesToRadians(to.lng - from.lng);
  const fromLat = degreesToRadians(from.lat);
  const toLat = degreesToRadians(to.lat);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(lngDelta / 2) *
      Math.sin(lngDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMeters * c);
}

export function getBoundsFromRegion(
  region: RestaurantMapRegion
): RestaurantBounds {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;

  return {
    northEast: {
      lat: region.latitude + halfLat,
      lng: region.longitude + halfLng,
    },
    southWest: {
      lat: region.latitude - halfLat,
      lng: region.longitude - halfLng,
    },
  };
}

export function getFallbackRestaurants(center: Coordinates = MUNICH_CENTER) {
  return FALLBACK_RESTAURANTS.map((restaurant) => ({
    ...restaurant,
    distanceMeters: getDistanceMeters(center, restaurant.location),
  })).sort((first, second) => {
    const firstDistance = first.distanceMeters ?? Number.MAX_SAFE_INTEGER;
    const secondDistance = second.distanceMeters ?? Number.MAX_SAFE_INTEGER;

    return firstDistance - secondDistance;
  });
}

export function getRestaurantKey(restaurant: RestaurantRecord) {
  return `${restaurant.provider}:${restaurant.providerPlaceId}`;
}

function normalizeOptionalText(value?: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function getOpeningHours(value: unknown) {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return { isOpenNow: null, text: [] };
  }

  const record = value as {
    openNow?: unknown;
    weekdayDescriptions?: unknown;
  };

  return {
    isOpenNow:
      typeof record.openNow === 'boolean' ? record.openNow : null,
    text: parseStringArray(record.weekdayDescriptions),
  };
}

function getPhotoUrl(photoRefs: string[]) {
  const [photoRef] = photoRefs;

  return photoRef
    ? `${env.SUPABASE_URL}/functions/v1/restaurant-photo?name=${encodeURIComponent(photoRef)}`
    : null;
}

function assertStars(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${label} muss zwischen 1 und 5 Sternen liegen.`);
  }
}

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Nicht eingeloggt.');
  }

  return user.id;
}

function restaurantRowToRecord(
  row: RestaurantTableRow,
  center?: Coordinates
): RestaurantRecord {
  const location = {
    lat: row.latitude,
    lng: row.longitude,
  };
  const openingHours = getOpeningHours(row.opening_hours);
  const photoRefs = parseStringArray(row.photo_refs);

  return {
    address: row.formatted_address,
    cuisine: row.cuisine,
    distanceMeters: center ? getDistanceMeters(center, location) : null,
    googleMapsUri: row.google_maps_uri,
    id: row.id,
    isOpenNow: openingHours.isOpenNow,
    location,
    name: row.name,
    openingHoursText: openingHours.text,
    phone: row.phone,
    photoRefs,
    photoUrl: getPhotoUrl(photoRefs),
    priceLevel: row.price_level,
    provider: row.provider === 'google_places' ? 'google_places' : 'fallback',
    providerPlaceId: row.provider_place_id,
    rating: row.rating,
    ratingCount: row.rating_count,
    source: row.provider === 'google_places' ? 'google_places' : 'fallback',
    types: row.place_types ?? [],
    websiteUrl: row.website_url,
  };
}

function normalizeRestaurant(value: unknown): RestaurantRecord | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Partial<RestaurantRecord>;

  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.location !== 'object' ||
    record.location === null ||
    typeof record.location.lat !== 'number' ||
    typeof record.location.lng !== 'number'
  ) {
    return null;
  }

  return {
    address: typeof record.address === 'string' ? record.address : null,
    cuisine: typeof record.cuisine === 'string' ? record.cuisine : null,
    distanceMeters:
      typeof record.distanceMeters === 'number' ? record.distanceMeters : null,
    googleMapsUri:
      typeof record.googleMapsUri === 'string' ? record.googleMapsUri : null,
    id: record.id,
    isOpenNow:
      typeof record.isOpenNow === 'boolean' ? record.isOpenNow : null,
    location: {
      lat: record.location.lat,
      lng: record.location.lng,
    },
    name: record.name,
    openingHoursText: parseStringArray(record.openingHoursText),
    phone: typeof record.phone === 'string' ? record.phone : null,
    photoRefs: parseStringArray(record.photoRefs),
    photoUrl: typeof record.photoUrl === 'string' ? record.photoUrl : null,
    priceLevel:
      typeof record.priceLevel === 'string' ? record.priceLevel : null,
    provider: record.provider === 'google_places' ? 'google_places' : 'fallback',
    providerPlaceId:
      typeof record.providerPlaceId === 'string'
        ? record.providerPlaceId
        : record.id,
    rating: typeof record.rating === 'number' ? record.rating : null,
    ratingCount:
      typeof record.ratingCount === 'number' ? record.ratingCount : null,
    source: record.source === 'google_places' ? 'google_places' : 'fallback',
    types: parseStringArray(record.types),
    websiteUrl:
      typeof record.websiteUrl === 'string' ? record.websiteUrl : null,
  };
}

function normalizeRoleLabel(value: unknown): RestaurantAiRoleLabel {
  return typeof value === 'string' &&
    RESTAURANT_AI_ROLE_LABELS.has(value as RestaurantAiRoleLabel)
    ? (value as RestaurantAiRoleLabel)
    : 'Sichere Wahl';
}

function normalizeConfidence(value: unknown): RestaurantAiConfidence {
  return typeof value === 'string' &&
    RESTAURANT_AI_CONFIDENCE.has(value as RestaurantAiConfidence)
    ? (value as RestaurantAiConfidence)
    : 'medium';
}

function normalizeScore(value: unknown) {
  const score = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(score)
    ? Math.max(0, Math.min(100, Math.round(score)))
    : 70;
}

function normalizeStringList(value: unknown, maxItems = 5) {
  return parseStringArray(value)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeInventoryIds(value: unknown) {
  return normalizeStringList(value, 3);
}

function normalizeAiRecommendation(value: unknown): RestaurantAiRecommendation | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const restaurant = normalizeRestaurant(record.restaurant);
  const restaurantId =
    typeof record.restaurantId === 'string' ? record.restaurantId : restaurant?.id;
  const providerPlaceId =
    typeof record.providerPlaceId === 'string'
      ? record.providerPlaceId
      : restaurant?.providerPlaceId;

  if (!restaurant || !restaurantId || !providerPlaceId) {
    return null;
  }

  return {
    confidence: normalizeConfidence(record.confidence),
    headline:
      typeof record.headline === 'string' && record.headline.trim()
        ? record.headline.trim()
        : 'Starke Option für deinen Anlass',
    matchingInventoryItemIds: normalizeInventoryIds(
      record.matchingInventoryItemIds
    ),
    providerPlaceId,
    rank:
      typeof record.rank === 'number' && Number.isFinite(record.rank)
        ? Math.max(1, Math.round(record.rank))
        : 1,
    reason:
      typeof record.reason === 'string' && record.reason.trim()
        ? record.reason.trim()
        : 'Die verfügbaren Daten sprechen insgesamt für dieses Restaurant.',
    restaurant,
    restaurantId,
    reviewSignals: normalizeStringList(record.reviewSignals),
    roleLabel: normalizeRoleLabel(record.roleLabel),
    score: normalizeScore(record.score),
    strengths: normalizeStringList(record.strengths),
    watchouts: normalizeStringList(record.watchouts, 4),
    wineFit:
      typeof record.wineFit === 'string' && record.wineFit.trim()
        ? record.wineFit.trim()
        : null,
  };
}

function normalizeRecommendationRun(value: unknown): RestaurantRecommendationRun | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const recommendations = Array.isArray(record.recommendations)
    ? record.recommendations
        .map(normalizeAiRecommendation)
        .filter(
          (
            recommendation
          ): recommendation is RestaurantAiRecommendation =>
            Boolean(recommendation)
        )
    : [];

  if (
    typeof record.id !== 'string' ||
    typeof record.contextLabel !== 'string' ||
    typeof record.generatedAt !== 'string' ||
    typeof record.expiresAt !== 'string' ||
    recommendations.length === 0
  ) {
    return null;
  }

  const occasion =
    typeof record.occasion === 'string' &&
    record.occasion in RESTAURANT_AI_OCCASION_LABELS
      ? (record.occasion as RestaurantAiOccasion)
      : 'nice_evening';

  return {
    contextLabel: record.contextLabel,
    expiresAt: record.expiresAt,
    generatedAt: record.generatedAt,
    id: record.id,
    occasion,
    recommendations,
  };
}

export async function ensureRestaurant(
  restaurant: RestaurantRecord,
  { save = false }: { save?: boolean } = {}
): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{
    restaurantId?: string;
  }>('save-restaurant', {
    body: { restaurant, save },
  });

  if (error || !data?.restaurantId) {
    throw new Error('Restaurant konnte nicht vorbereitet werden.');
  }

  return data.restaurantId;
}

export async function getSavedRestaurants(): Promise<SavedRestaurantRecord[]> {
  const { data, error } = await supabase
    .from('saved_restaurants')
    .select('*, restaurant:restaurants(*)')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message ?? 'Gemerkte Restaurants konnten nicht geladen werden.');
  }

  return ((data ?? []) as SavedRestaurantRow[])
    .filter((row) => row.restaurant)
    .map((row) => ({
      id: row.id,
      restaurant: row.restaurant ? restaurantRowToRecord(row.restaurant) : null,
      restaurantId: row.restaurant_id,
      restaurantKey: `${row.restaurant?.provider}:${row.restaurant?.provider_place_id}`,
    }));
}

export async function getRestaurantDetails(
  input: RestaurantDetailInput
): Promise<RestaurantRecord> {
  const { data, error } = await supabase.functions.invoke<{
    restaurant?: unknown;
  }>('restaurant-detail', {
    body: input,
  });

  const restaurant = normalizeRestaurant(data?.restaurant);

  if (error || !restaurant) {
    throw new Error('Restaurant-Details konnten nicht geladen werden.');
  }

  return restaurant;
}

export async function analyzeRestaurants(
  input: AnalyzeRestaurantsInput
): Promise<RestaurantRecommendationRun> {
  const { data, error } = await supabase.functions.invoke<{
    run?: unknown;
  }>('analyze-restaurants', {
    body: input,
  });
  const run = normalizeRecommendationRun(data?.run);

  if (error || !run) {
    throw new Error('KI-Empfehlung konnte nicht erstellt werden.');
  }

  return run;
}

export async function getRestaurantRecommendationRun(
  runId: string
): Promise<RestaurantRecommendationRun> {
  const { data, error } = await supabase
    .from('restaurant_recommendation_runs')
    .select('recommendation_payload')
    .eq('id', runId)
    .single();
  const payload =
    (data as Pick<RestaurantRecommendationRunRow, 'recommendation_payload'> | null)
      ?.recommendation_payload ?? null;
  const run = normalizeRecommendationRun(payload);

  if (error || !run) {
    throw new Error('KI-Auswahl konnte nicht geladen werden.');
  }

  return run;
}

export async function getLatestRestaurantAiRecommendation(
  restaurantId: string
): Promise<RestaurantAiRecommendation | null> {
  const { data, error } = await supabase
    .from('restaurant_ai_analyses')
    .select('*, restaurant:restaurants(*)')
    .eq('restaurant_id', restaurantId)
    .gt('expires_at', new Date().toISOString())
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as RestaurantAiAnalysisRow | null;

  if (!row?.restaurant) {
    return null;
  }

  return normalizeAiRecommendation({
    confidence: row.confidence,
    headline: row.headline,
    matchingInventoryItemIds: row.matching_inventory_item_ids,
    providerPlaceId: row.provider_place_id,
    rank: 1,
    reason: row.reason,
    restaurant: restaurantRowToRecord(row.restaurant),
    restaurantId: row.restaurant_id,
    reviewSignals: row.review_signals,
    roleLabel: row.role_label,
    score: row.score,
    strengths: row.strengths,
    watchouts: row.watchouts,
    wineFit: row.wine_fit,
  });
}

export async function geocodeRestaurantCity(
  query: string
): Promise<GeocodedCity> {
  const { data, error } = await supabase.functions.invoke<{
    city?: GeocodedCity;
  }>('geocode-city', {
    body: { query },
  });

  if (
    error ||
    !data?.city ||
    typeof data.city.label !== 'string' ||
    typeof data.city.region?.latitude !== 'number' ||
    typeof data.city.region.longitude !== 'number'
  ) {
    throw new Error('Stadt konnte nicht gefunden werden.');
  }

  return data.city;
}

export async function saveRestaurant(
  restaurant: RestaurantRecord
): Promise<string> {
  return ensureRestaurant(restaurant, { save: true });
}

export async function removeSavedRestaurant(
  restaurant: RestaurantRecord
): Promise<void> {
  const { data: existingRestaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id')
    .eq('provider', restaurant.provider)
    .eq('provider_place_id', restaurant.providerPlaceId)
    .maybeSingle();

  if (restaurantError) {
    throw new Error(restaurantError.message);
  }

  if (!existingRestaurant?.id) {
    return;
  }

  const { error } = await supabase
    .from('saved_restaurants')
    .delete()
    .eq('restaurant_id', existingRestaurant.id);

  if (error) {
    throw new Error(error.message ?? 'Restaurant konnte nicht entfernt werden.');
  }
}

export async function getRestaurantById(
  restaurantId: string,
  center?: Coordinates
): Promise<RestaurantRecord | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select()
    .eq('id', restaurantId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? restaurantRowToRecord(data, center) : null;
}

export async function getRestaurantRating(
  restaurantId: string
): Promise<RestaurantRatingRecord | null> {
  const { data, error } = await supabase
    .from('restaurant_ratings')
    .select('id, notes, overall_stars, restaurant_id, visited_at, wine_stars')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function saveRestaurantRating({
  notes,
  overallStars,
  restaurant,
  visitedAt,
  wineStars,
}: RestaurantRatingInput): Promise<RestaurantRatingRecord> {
  assertStars(overallStars, 'Gesamtbewertung');
  assertStars(wineStars, 'Wein-Erlebnis');

  const [userId, restaurantId] = await Promise.all([
    getCurrentUserId(),
    ensureRestaurant(restaurant),
  ]);
  const { data, error } = await supabase
    .from('restaurant_ratings')
    .upsert(
      {
        notes: normalizeOptionalText(notes),
        overall_stars: overallStars,
        restaurant_id: restaurantId,
        updated_at: new Date().toISOString(),
        user_id: userId,
        visited_at: visitedAt || null,
        wine_stars: wineStars,
      },
      { onConflict: 'user_id,restaurant_id' }
    )
    .select('id, notes, overall_stars, restaurant_id, visited_at, wine_stars')
    .single();

  if (error) {
    throw new Error(error.message ?? 'Restaurant-Bewertung konnte nicht gespeichert werden.');
  }

  return data;
}

export async function saveRestaurantVisit({
  inventoryItemId,
  notes,
  restaurant,
  visitedAt,
  vintageId,
}: RestaurantVisitInput): Promise<RestaurantVisitRecord> {
  const [userId, restaurantId] = await Promise.all([
    getCurrentUserId(),
    ensureRestaurant(restaurant),
  ]);
  const { data, error } = await supabase
    .from('restaurant_visits')
    .insert({
      inventory_item_id: inventoryItemId || null,
      notes: normalizeOptionalText(notes),
      restaurant_id: restaurantId,
      user_id: userId,
      visited_at: visitedAt,
      vintage_id: vintageId || null,
    })
    .select('id, inventory_item_id, notes, restaurant_id, visited_at, vintage_id')
    .single();

  if (error) {
    throw new Error(error.message ?? 'Restaurant-Besuch konnte nicht gespeichert werden.');
  }

  return data;
}

export async function getRestaurantVisits(
  restaurantId: string
): Promise<RestaurantVisitListItem[]> {
  const { data, error } = await supabase
    .from('restaurant_visits')
    .select(
      `
        id,
        inventory_item_id,
        notes,
        restaurant_id,
        visited_at,
        vintage_id,
        inventory_item:inventory_items (
          vintage:vintages (
            vintage_year,
            wine:wines (
              producer,
              wine_name
            )
          )
        )
      `
    )
    .eq('restaurant_id', restaurantId)
    .order('visited_at', { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message ?? 'Besuche konnten nicht geladen werden.');
  }

  return ((data ?? []) as RestaurantVisitRow[]).map((visit) => {
    const wine = visit.inventory_item?.vintage?.wine;
    const year = visit.inventory_item?.vintage?.vintage_year;
    const wineLabel = wine
      ? `${wine.producer} ${wine.wine_name}${year ? `, ${year}` : ''}`
      : null;

    return {
      id: visit.id,
      inventory_item_id: visit.inventory_item_id,
      notes: visit.notes,
      restaurant_id: visit.restaurant_id,
      visited_at: visit.visited_at,
      vintage_id: visit.vintage_id,
      wineLabel,
    };
  });
}

export async function searchRestaurants(
  input: RestaurantSearchInput
): Promise<RestaurantSearchResult> {
  const fallback = getFallbackRestaurants(input.center);

  try {
    const { data, error } = await supabase.functions.invoke<{
      data?: unknown[];
      source?: string;
    }>('search-restaurants', {
      body: input,
    });

    if (error || !Array.isArray(data?.data)) {
      return { data: fallback, source: 'fallback' };
    }

    const normalizedRestaurants = data.data
      .map(normalizeRestaurant)
      .filter((restaurant): restaurant is RestaurantRecord =>
        Boolean(restaurant)
      );

    if (normalizedRestaurants.length === 0) {
      return { data: fallback, source: 'fallback' };
    }

    return {
      data: normalizedRestaurants,
      source: data.source === 'google_places' ? 'google_places' : 'fallback',
    };
  } catch {
    return { data: fallback, source: 'fallback' };
  }
}
