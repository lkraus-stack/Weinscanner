import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { createTextChatCompletion } from '../_shared/ai.ts';
import {
  createServiceClient,
  errorResponse,
  handleCors,
  isRecord,
  jsonResponse,
  requirePost,
  requireUser,
} from '../_shared/http.ts';
import { extractJson } from '../_shared/wine-schema.ts';

type Coordinates = {
  lat: number;
  lng: number;
};

type RestaurantCandidate = {
  address: string | null;
  cuisine: string | null;
  distanceMeters: number | null;
  googleMapsUri: string | null;
  id: string;
  isOpenNow: boolean | null;
  location: Coordinates;
  name: string;
  openingHoursText: string[];
  phone: string | null;
  photoRefs: string[];
  priceLevel: string | null;
  provider: 'fallback' | 'google_places';
  providerPlaceId: string;
  rating: number | null;
  ratingCount: number | null;
  source: 'fallback' | 'google_places';
  types: string[];
  websiteUrl: string | null;
};

type RestaurantRow = {
  cuisine: string | null;
  formatted_address: string | null;
  google_maps_uri: string | null;
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  opening_hours: {
    openNow?: boolean | null;
    weekdayDescriptions?: string[];
  } | null;
  phone: string | null;
  photo_refs: string[] | null;
  place_types: string[] | null;
  price_level: string | null;
  provider: 'fallback' | 'google_places';
  provider_place_id: string;
  rating: number | null;
  rating_count: number | null;
  website_url: string | null;
};

type GoogleReview = {
  originalText?: { text?: string };
  publishTime?: string;
  rating?: number;
  relativePublishTimeDescription?: string;
  text?: { text?: string };
};

type GooglePlaceDetails = {
  dineIn?: boolean;
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  id?: string;
  location?: { latitude?: number; longitude?: number };
  photos?: Array<{ name?: string }>;
  priceLevel?: string;
  primaryType?: string;
  rating?: number;
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  reservable?: boolean;
  reviewSummary?: { text?: { text?: string } };
  reviews?: GoogleReview[];
  servesDinner?: boolean;
  servesWine?: boolean;
  types?: string[];
  userRatingCount?: number;
  websiteUri?: string;
};

type StoredRestaurant = {
  candidate: RestaurantCandidate;
  row: RestaurantRow;
};

type AnalysisContext = StoredRestaurant & {
  appRating: {
    notes: string | null;
    overall_stars: number;
    wine_stars: number;
  } | null;
  details: GooglePlaceDetails | null;
  matchingInventoryItemIds: string[];
};

const ANALYSIS_VERSION = 'v1';
const MAX_INPUT_RESTAURANTS = 8;
const MAX_ANALYZED_RESTAURANTS = 5;
const MAX_DAILY_RUNS = 5;
const RUN_CACHE_MS = 12 * 60 * 60 * 1000;
const ANALYSIS_CACHE_MS = 24 * 60 * 60 * 1000;

const OCCASIONS = new Set([
  'quick_bite',
  'nice_evening',
  'special_experience',
  'travel',
  'wine_focus',
]);

const OCCASION_LABELS: Record<string, string> = {
  nice_evening: 'Schöner Abend',
  quick_bite: 'Schnelles Essen',
  special_experience: 'Besonderes Erlebnis',
  travel: 'Reise',
  wine_focus: 'Weinfokus',
};

const ROLE_LABELS = new Set([
  'Beste Wahl',
  'Beste Wein-Option',
  'Besonderes Erlebnis',
  'Preis-Leistung',
  'Sichere Wahl',
]);

const CONFIDENCE = new Set(['high', 'low', 'medium']);

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringList(value: unknown, maxItems = 8) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems)
    : [];
}

function parseCoordinates(value: unknown): Coordinates | null {
  if (!isRecord(value)) {
    return null;
  }

  const lat = numberValue(value.lat);
  const lng = numberValue(value.lng);

  return lat === null || lng === null ? null : { lat, lng };
}

function parseRestaurant(value: unknown): RestaurantCandidate | null {
  if (!isRecord(value)) {
    return null;
  }

  const location = parseCoordinates(value.location);
  const name = stringValue(value.name);
  const provider =
    value.provider === 'google_places' || value.provider === 'fallback'
      ? value.provider
      : null;
  const providerPlaceId = stringValue(value.providerPlaceId);

  if (!location || !name || !provider || !providerPlaceId) {
    return null;
  }

  return {
    address: stringValue(value.address),
    cuisine: stringValue(value.cuisine),
    distanceMeters: numberValue(value.distanceMeters),
    googleMapsUri: stringValue(value.googleMapsUri),
    id: stringValue(value.id) ?? providerPlaceId,
    isOpenNow:
      typeof value.isOpenNow === 'boolean' ? value.isOpenNow : null,
    location,
    name,
    openingHoursText: stringList(value.openingHoursText),
    phone: stringValue(value.phone),
    photoRefs: stringList(value.photoRefs),
    priceLevel: stringValue(value.priceLevel),
    provider,
    providerPlaceId,
    rating: numberValue(value.rating),
    ratingCount: numberValue(value.ratingCount),
    source: provider,
    types: stringList(value.types),
    websiteUrl: stringValue(value.websiteUrl),
  };
}

function parseRequest(value: unknown) {
  if (!isRecord(value)) {
    throw new Error('Ungültige KI-Anfrage.');
  }

  const occasion = stringValue(value.occasion);
  const contextLabel = stringValue(value.contextLabel) ?? 'Aktuelle Suche';
  const restaurants = Array.isArray(value.restaurants)
    ? value.restaurants
        .map(parseRestaurant)
        .filter(
          (restaurant): restaurant is RestaurantCandidate =>
            Boolean(restaurant)
        )
        .slice(0, MAX_INPUT_RESTAURANTS)
    : [];

  if (!occasion || !OCCASIONS.has(occasion)) {
    throw new Error('Anlass fehlt.');
  }

  if (restaurants.length === 0) {
    throw new Error('Keine Restaurants für die Analyse gefunden.');
  }

  return {
    center: parseCoordinates(value.center),
    contextLabel,
    filters: isRecord(value.filters) ? value.filters : {},
    occasion,
    restaurants,
  };
}

function formatPriceLevel(value?: string) {
  switch (value) {
    case 'PRICE_LEVEL_FREE':
      return 'Kostenlos';
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 'Einfach';
    case 'PRICE_LEVEL_MODERATE':
      return 'Mittel';
    case 'PRICE_LEVEL_EXPENSIVE':
      return 'Gehoben';
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 'Premium';
    default:
      return null;
  }
}

function formatCuisine(place: GooglePlaceDetails) {
  const types = [place.primaryType, ...(place.types ?? [])].filter(
    (value): value is string => typeof value === 'string'
  );

  if (types.includes('wine_bar')) return 'Weinbar';
  if (types.includes('fine_dining_restaurant')) return 'Fine Dining';
  if (types.includes('italian_restaurant')) return 'Italienisch';
  if (types.includes('french_restaurant')) return 'Französisch';
  if (types.includes('german_restaurant')) return 'Deutsch';
  if (types.includes('mediterranean_restaurant')) return 'Mediterran';
  if (types.includes('cafe')) return 'Café';
  if (types.includes('bar')) return 'Bar';
  if (types.includes('restaurant')) return 'Restaurant';

  return null;
}

function restaurantRowToResponse(row: RestaurantRow) {
  const photoRefs = row.photo_refs ?? [];
  const location = {
    lat: Number(row.latitude),
    lng: Number(row.longitude),
  };

  return {
    address: row.formatted_address,
    cuisine: row.cuisine,
    distanceMeters: null,
    googleMapsUri: row.google_maps_uri,
    id: row.id,
    isOpenNow:
      typeof row.opening_hours?.openNow === 'boolean'
        ? row.opening_hours.openNow
        : null,
    location,
    name: row.name,
    openingHoursText: row.opening_hours?.weekdayDescriptions ?? [],
    phone: row.phone,
    photoRefs,
    photoUrl:
      photoRefs.length > 0
        ? `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/restaurant-photo?name=${encodeURIComponent(photoRefs[0])}`
        : null,
    priceLevel: row.price_level,
    provider: row.provider,
    providerPlaceId: row.provider_place_id,
    rating: row.rating,
    ratingCount: row.rating_count,
    source: row.provider,
    types: row.place_types ?? [],
    websiteUrl: row.website_url,
  };
}

function candidateToUpsert(candidate: RestaurantCandidate) {
  return {
    cuisine: candidate.cuisine,
    formatted_address: candidate.address,
    google_maps_uri: candidate.googleMapsUri,
    latitude: candidate.location.lat,
    longitude: candidate.location.lng,
    name: candidate.name,
    opening_hours: {
      openNow: candidate.isOpenNow,
      weekdayDescriptions: candidate.openingHoursText,
    },
    phone: candidate.phone,
    photo_refs: candidate.photoRefs,
    place_types: candidate.types,
    price_level: candidate.priceLevel,
    provider: candidate.provider,
    provider_place_id: candidate.providerPlaceId,
    rating: candidate.rating,
    rating_count: candidate.ratingCount,
    source_payload: { source: 'client_candidate' },
    updated_at: new Date().toISOString(),
    website_url: candidate.websiteUrl,
  };
}

function detailsToUpsert(place: GooglePlaceDetails) {
  if (
    !place.id ||
    !place.displayName?.text ||
    typeof place.location?.latitude !== 'number' ||
    typeof place.location.longitude !== 'number'
  ) {
    return null;
  }

  return {
    cuisine: formatCuisine(place),
    formatted_address: place.formattedAddress ?? null,
    google_maps_uri: place.googleMapsUri ?? place.websiteUri ?? null,
    latitude: place.location.latitude,
    longitude: place.location.longitude,
    name: place.displayName.text,
    opening_hours:
      place.regularOpeningHours
        ? {
            openNow: place.regularOpeningHours.openNow ?? null,
            weekdayDescriptions:
              place.regularOpeningHours.weekdayDescriptions ?? [],
          }
        : null,
    photo_refs: (place.photos ?? [])
      .map((photo) => photo.name)
      .filter((name): name is string => typeof name === 'string')
      .slice(0, 8),
    place_types: place.types ?? [],
    price_level: formatPriceLevel(place.priceLevel),
    provider: 'google_places',
    provider_place_id: place.id,
    rating: typeof place.rating === 'number' ? place.rating : null,
    rating_count:
      typeof place.userRatingCount === 'number'
        ? place.userRatingCount
        : null,
    source_payload: {
      ai_details_fetched_at: new Date().toISOString(),
      has_review_summary: Boolean(place.reviewSummary?.text?.text),
      review_count_used: Array.isArray(place.reviews)
        ? Math.min(place.reviews.length, 5)
        : 0,
    },
    updated_at: new Date().toISOString(),
    website_url: place.websiteUri ?? null,
  };
}

function candidateScore(candidate: RestaurantCandidate) {
  const rating = candidate.rating ?? 0;
  const count = Math.min(candidate.ratingCount ?? 0, 500);
  const distancePenalty = Math.min(candidate.distanceMeters ?? 3000, 8000) / 300;
  const wineBoost =
    candidate.types.includes('wine_bar') ||
    candidate.types.includes('fine_dining_restaurant')
      ? 10
      : 0;
  const openBoost = candidate.isOpenNow === true ? 5 : 0;

  return rating * 20 + count / 20 + wineBoost + openBoost - distancePenalty;
}

async function hashRequest(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchGoogleDetails(providerPlaceId: string) {
  const googlePlacesKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

  if (!googlePlacesKey) {
    return null;
  }

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${providerPlaceId}?languageCode=de`,
    {
      headers: {
        'X-Goog-Api-Key': googlePlacesKey,
        'X-Goog-FieldMask':
          'id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,types,primaryType,regularOpeningHours,googleMapsUri,websiteUri,photos,reviews,reviewSummary,servesWine,servesDinner,dineIn,reservable',
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as GooglePlaceDetails;
}

function getReviewText(review: GoogleReview) {
  return review.text?.text ?? review.originalText?.text ?? null;
}

function buildReviewEvidence(details: GooglePlaceDetails | null) {
  const reviews = (details?.reviews ?? []).slice(0, 5);

  return {
    reviewSummary: details?.reviewSummary?.text?.text ?? null,
    reviews: reviews
      .map((review) => ({
        age: review.relativePublishTimeDescription ?? null,
        rating: typeof review.rating === 'number' ? review.rating : null,
        text: getReviewText(review)?.slice(0, 700) ?? null,
      }))
      .filter((review) => review.text),
  };
}

function getInventoryScore(item: {
  quantity: number | null;
  wine_color: string | null;
}, context: AnalysisContext) {
  const types = context.row.place_types ?? [];
  const cuisine = context.row.cuisine?.toLocaleLowerCase('de-DE') ?? '';
  const color = item.wine_color;

  if (!color) return 0;
  if (types.includes('wine_bar')) return item.quantity ? 4 : 2;
  if (types.includes('fine_dining_restaurant')) return item.quantity ? 4 : 2;
  if (
    types.includes('italian_restaurant') ||
    types.includes('mediterranean_restaurant') ||
    cuisine.includes('italienisch') ||
    cuisine.includes('mediterran')
  ) {
    return ['rot', 'weiss', 'schaum'].includes(color) ? 3 : 1;
  }

  return item.quantity ? 1 : 0;
}

async function getInventoryHighlights(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const { data } = await supabase
    .from('inventory_items')
    .select(
      `
        id,
        quantity,
        vintage:vintages (
          vintage_year,
          wine:wines (
            producer,
            wine_name,
            wine_color
          )
        )
      `
    )
    .eq('user_id', userId)
    .gt('quantity', 0)
    .limit(30);

  return ((data ?? []) as Array<{
    id: string;
    quantity: number | null;
    vintage: {
      vintage_year: number | null;
      wine: {
        producer: string;
        wine_color: string | null;
        wine_name: string;
      } | null;
    } | null;
  }>).map((item) => ({
    id: item.id,
    label: item.vintage?.wine
      ? `${item.vintage.wine.producer} ${item.vintage.wine.wine_name}${
          item.vintage.vintage_year ? ` ${item.vintage.vintage_year}` : ''
        }`
      : 'Unbekannter Wein',
    quantity: item.quantity,
    wine_color: item.vintage?.wine?.wine_color ?? null,
  }));
}

function roleLabel(value: unknown, fallback: string) {
  return typeof value === 'string' && ROLE_LABELS.has(value)
    ? value
    : fallback;
}

function confidence(value: unknown) {
  return typeof value === 'string' && CONFIDENCE.has(value) ? value : 'medium';
}

function score(value: unknown) {
  const numberScore = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(numberScore)
    ? Math.max(0, Math.min(100, Math.round(numberScore)))
    : 70;
}

function requiredString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function recommendationList(value: unknown, maxItems = 5) {
  return stringList(value, maxItems);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function fallbackConfidence(context: AnalysisContext) {
  const rating = context.row.rating ?? 0;
  const ratingCount = context.row.rating_count ?? 0;

  if (rating >= 4.4 && ratingCount >= 100) {
    return 'high';
  }

  if (rating >= 4.1 && ratingCount >= 30) {
    return 'medium';
  }

  return 'low';
}

function fallbackRoleLabel(context: AnalysisContext, index: number) {
  const types = context.row.place_types ?? [];

  if (
    index > 0 &&
    (types.includes('wine_bar') ||
      types.includes('fine_dining_restaurant') ||
      context.matchingInventoryItemIds.length > 0)
  ) {
    return 'Beste Wein-Option';
  }

  if (index === 0) return 'Beste Wahl';
  if (index === 1) return 'Sichere Wahl';

  return 'Preis-Leistung';
}

function fallbackScore(context: AnalysisContext) {
  const rating = context.row.rating ?? 3.8;
  const ratingCount = context.row.rating_count ?? 0;
  const reviewBoost = Math.min(Math.log10(Math.max(ratingCount, 1)) * 8, 22);
  const wineBoost =
    context.matchingInventoryItemIds.length > 0 ||
    (context.row.place_types ?? []).includes('wine_bar')
      ? 8
      : 0;
  const openBoost = context.row.opening_hours?.openNow === true ? 4 : 0;
  const distancePenalty = Math.min(context.candidate.distanceMeters ?? 2500, 8000) / 600;

  return clampScore(rating * 14 + reviewBoost + wineBoost + openBoost - distancePenalty);
}

function fallbackStrengths(context: AnalysisContext) {
  const strengths = [
    context.row.rating
      ? `${context.row.rating.toFixed(1).replace('.', ',')} Sterne bei Google`
      : null,
    context.row.rating_count && context.row.rating_count >= 50
      ? `${context.row.rating_count} Bewertungen als solide Datenbasis`
      : null,
    context.row.opening_hours?.openNow === true ? 'Aktuell geöffnet' : null,
    context.matchingInventoryItemIds.length > 0
      ? 'Passt zu Weinen aus deinem Bestand'
      : null,
    context.row.cuisine ? `${context.row.cuisine} als klare Küchenrichtung` : null,
  ];

  return strengths.filter((strength): strength is string => Boolean(strength)).slice(0, 5);
}

function fallbackWatchouts(context: AnalysisContext) {
  const watchouts = [
    (context.row.rating_count ?? 0) < 30
      ? 'Wenige öffentliche Bewertungen, daher vorsichtig einschätzen.'
      : null,
    context.row.opening_hours?.openNow === false
      ? 'Aktuell nicht geöffnet. Öffnungszeiten vor dem Besuch prüfen.'
      : null,
    !context.details?.reviews?.length
      ? 'Google liefert nur begrenzte Review-Details für diese Auswahl.'
      : null,
    context.candidate.distanceMeters && context.candidate.distanceMeters > 5000
      ? 'Etwas weiter entfernt als die direktesten Optionen.'
      : null,
  ];

  return watchouts.filter((watchout): watchout is string => Boolean(watchout)).slice(0, 4);
}

function fallbackReviewSignals(context: AnalysisContext) {
  const evidence = buildReviewEvidence(context.details);
  const signals = [
    evidence.reviewSummary ? 'Google Review-Zusammenfassung vorhanden' : null,
    evidence.reviews.length > 0
      ? `${evidence.reviews.length} aktuelle Review-Auszüge geprüft`
      : null,
    context.row.rating_count
      ? `${context.row.rating_count} Google-Bewertungen berücksichtigt`
      : null,
    context.details?.servesWine === true ? 'Google signalisiert Weinangebot' : null,
  ];

  return signals.filter((signal): signal is string => Boolean(signal)).slice(0, 5);
}

function fallbackWineFit(context: AnalysisContext) {
  if (context.matchingInventoryItemIds.length > 0) {
    return 'Aus deinem Bestand gibt es passende Weine für diese Küchenrichtung.';
  }

  if (context.details?.servesWine === true || (context.row.place_types ?? []).includes('wine_bar')) {
    return 'Das Restaurant wirkt für Weintrinker interessant, auch wenn kein konkreter Bestandstreffer vorliegt.';
  }

  return 'Wein-Fit ist anhand der verfügbaren Daten noch nicht stark belegbar.';
}

function createFallbackRecommendations(contexts: AnalysisContext[]) {
  return {
    recommendations: contexts.slice(0, 3).map((context, index) => ({
      confidence: fallbackConfidence(context),
      headline:
        index === 0
          ? 'Stärkste Option aus den verfügbaren Signalen'
          : 'Gute Alternative mit klaren Stärken',
      providerPlaceId: context.row.provider_place_id,
      reason:
        'Diese Auswahl basiert auf Google-Bewertung, Bewertungsanzahl, Entfernung, Öffnungsstatus und deinem Wine-Scanner-Kontext.',
      reviewSignals: fallbackReviewSignals(context),
      roleLabel: fallbackRoleLabel(context, index),
      score: fallbackScore(context),
      strengths: fallbackStrengths(context),
      watchouts: fallbackWatchouts(context),
      wineFit: fallbackWineFit(context),
    })),
  };
}

function buildPromptPayload(
  contexts: AnalysisContext[],
  occasion: string,
  contextLabel: string,
  inventory: Array<{ id: string; label: string; wine_color: string | null }>
) {
  return {
    anlass: OCCASION_LABELS[occasion] ?? occasion,
    datenhinweis:
      'Google Places liefert maximal 5 Reviews pro Restaurant. Keine Gewissheit vortäuschen.',
    kontext: contextLabel,
    restaurants: contexts.map((context) => ({
      appRating: context.appRating,
      cuisine: context.row.cuisine,
      distanceMeters: context.candidate.distanceMeters,
      googleRating: context.row.rating,
      googleRatingCount: context.row.rating_count,
      isOpenNow: context.row.opening_hours?.openNow ?? null,
      name: context.row.name,
      priceLevel: context.row.price_level,
      providerPlaceId: context.row.provider_place_id,
      reviewEvidence: buildReviewEvidence(context.details),
      servesWine: context.details?.servesWine ?? null,
      types: context.row.place_types ?? [],
    })),
    userInventory: inventory.slice(0, 8),
  };
}

const SYSTEM_PROMPT = `
Du bist ein deutschsprachiger Restaurantkritiker mit Sommelier-Blick.
Du kuratierst Top-3 Restaurants für Wine Scanner.
Nutze nur die gelieferten Fakten, Google-Review-Signale und Wine-Scanner-Daten.
Hohe Sterne allein reichen nicht. Wenige Reviews senken die Sicherheit.
Nenne ehrlich Schwächen. Keine absoluten Aussagen.
Antworte ausschließlich als JSON mit:
{
  "recommendations": [
    {
      "providerPlaceId": "string",
      "roleLabel": "Beste Wahl | Beste Wein-Option | Sichere Wahl | Besonderes Erlebnis | Preis-Leistung",
      "score": 0,
      "confidence": "high | medium | low",
      "headline": "maximal 70 Zeichen",
      "reason": "maximal 220 Zeichen",
      "strengths": ["max 5"],
      "watchouts": ["max 4"],
      "reviewSignals": ["max 5"],
      "wineFit": "maximal 180 Zeichen"
    }
  ]
}
`.trim();

async function createAiRecommendations(
  contexts: AnalysisContext[],
  occasion: string,
  contextLabel: string,
  inventory: Array<{ id: string; label: string; wine_color: string | null }>
) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 45_000);

  try {
    const responseText = await createTextChatCompletion({
      maxTokens: 3500,
      signal: abortController.signal,
      system: SYSTEM_PROMPT,
      userText: JSON.stringify(
        buildPromptPayload(contexts, occasion, contextLabel, inventory),
        null,
        2
      ),
    });

    try {
      return extractJson(responseText);
    } catch {
      return createFallbackRecommendations(contexts);
    }
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  try {
    requirePost(req);
    const user = await requireUser(req);
    const payload = parseRequest(await req.json());
    const supabase = createServiceClient();
    const requestHash = await hashRequest({
      center: payload.center
        ? {
            lat: Math.round(payload.center.lat * 1000) / 1000,
            lng: Math.round(payload.center.lng * 1000) / 1000,
          }
        : null,
      contextLabel: payload.contextLabel,
      filters: payload.filters,
      occasion: payload.occasion,
      restaurants: payload.restaurants.map((restaurant) => ({
        provider: restaurant.provider,
        providerPlaceId: restaurant.providerPlaceId,
      })),
    });
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: cachedRun } = await supabase
      .from('restaurant_recommendation_runs')
      .select('recommendation_payload')
      .eq('user_id', user.id)
      .eq('request_hash', requestHash)
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (cachedRun?.recommendation_payload) {
      return jsonResponse({ run: cachedRun.recommendation_payload });
    }

    const { count: recentRuns } = await supabase
      .from('restaurant_recommendation_runs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('generated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if ((recentRuns ?? 0) >= MAX_DAILY_RUNS) {
      throw new Error(
        'Du hast heute schon mehrere KI-Empfehlungen erstellt. Bitte versuche es morgen erneut.'
      );
    }

    const topCandidates = payload.restaurants
      .slice()
      .sort((first, second) => candidateScore(second) - candidateScore(first))
      .slice(0, MAX_ANALYZED_RESTAURANTS);
    const { data: storedRows, error: storeError } = await supabase
      .from('restaurants')
      .upsert(topCandidates.map(candidateToUpsert), {
        onConflict: 'provider,provider_place_id',
      })
      .select(
        'id, provider, provider_place_id, name, formatted_address, latitude, longitude, rating, rating_count, price_level, cuisine, google_maps_uri, opening_hours, phone, website_url, photo_refs, place_types'
      );

    if (storeError || !Array.isArray(storedRows)) {
      throw storeError ?? new Error('Restaurants konnten nicht vorbereitet werden.');
    }

    const byProviderPlaceId = new Map(
      topCandidates.map((candidate) => [candidate.providerPlaceId, candidate])
    );
    const stored: StoredRestaurant[] = (storedRows as RestaurantRow[])
      .map((row) => {
        const candidate = byProviderPlaceId.get(row.provider_place_id);

        return candidate ? { candidate, row } : null;
      })
      .filter((item): item is StoredRestaurant => Boolean(item));
    const inventory = await getInventoryHighlights(supabase, user.id);
    const contexts: AnalysisContext[] = [];

    for (const item of stored) {
      const details =
        item.row.provider === 'google_places'
          ? await fetchGoogleDetails(item.row.provider_place_id)
          : null;
      let row = item.row;
      const detailsUpsert = details ? detailsToUpsert(details) : null;

      if (detailsUpsert) {
        const { data: updatedRow } = await supabase
          .from('restaurants')
          .upsert(detailsUpsert, { onConflict: 'provider,provider_place_id' })
          .select(
            'id, provider, provider_place_id, name, formatted_address, latitude, longitude, rating, rating_count, price_level, cuisine, google_maps_uri, opening_hours, phone, website_url, photo_refs, place_types'
          )
          .single();

        if (updatedRow) {
          row = updatedRow as RestaurantRow;
        }
      }

      const { data: rating } = await supabase
        .from('restaurant_ratings')
        .select('overall_stars, wine_stars, notes')
        .eq('user_id', user.id)
        .eq('restaurant_id', row.id)
        .maybeSingle();

      const baseContext = {
        appRating: rating as AnalysisContext['appRating'],
        candidate: item.candidate,
        details,
        matchingInventoryItemIds: [],
        row,
      };
      const matchingInventoryItemIds = inventory
        .map((inventoryItem) => ({
          id: inventoryItem.id,
          score: getInventoryScore(inventoryItem, baseContext),
        }))
        .filter((inventoryItem) => inventoryItem.score > 0)
        .sort((first, second) => second.score - first.score)
        .slice(0, 3)
        .map((inventoryItem) => inventoryItem.id);

      contexts.push({ ...baseContext, matchingInventoryItemIds });
    }

    const aiJson = await createAiRecommendations(
      contexts,
      payload.occasion,
      payload.contextLabel,
      inventory
    );
    const rawRecommendations = Array.isArray(aiJson.recommendations)
      ? aiJson.recommendations
      : [];
    const contextByProviderPlaceId = new Map(
      contexts.map((context) => [context.row.provider_place_id, context])
    );
    const recommendations = rawRecommendations
      .map((rawRecommendation: unknown, index: number) => {
        if (!isRecord(rawRecommendation)) {
          return null;
        }

        const providerPlaceId = stringValue(rawRecommendation.providerPlaceId);
        const context = providerPlaceId
          ? contextByProviderPlaceId.get(providerPlaceId)
          : null;

        if (!context) {
          return null;
        }

        return {
          confidence: confidence(rawRecommendation.confidence),
          headline: requiredString(
            rawRecommendation.headline,
            'Starke Option für deinen Anlass'
          ),
          matchingInventoryItemIds: context.matchingInventoryItemIds,
          providerPlaceId: context.row.provider_place_id,
          rank: index + 1,
          reason: requiredString(
            rawRecommendation.reason,
            'Die verfügbaren Daten sprechen insgesamt für dieses Restaurant.'
          ),
          restaurant: restaurantRowToResponse(context.row),
          restaurantId: context.row.id,
          reviewSignals: recommendationList(rawRecommendation.reviewSignals),
          roleLabel: roleLabel(
            rawRecommendation.roleLabel,
            index === 0 ? 'Beste Wahl' : 'Sichere Wahl'
          ),
          score: score(rawRecommendation.score),
          strengths: recommendationList(rawRecommendation.strengths),
          watchouts: recommendationList(rawRecommendation.watchouts, 4),
          wineFit: stringValue(rawRecommendation.wineFit),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 3);

    if (recommendations.length === 0) {
      throw new Error('Die KI konnte keine belastbare Auswahl erstellen.');
    }

    const generatedAt = now.toISOString();
    const expiresAt = new Date(Date.now() + RUN_CACHE_MS).toISOString();
    const analysisExpiresAt = new Date(Date.now() + ANALYSIS_CACHE_MS).toISOString();
    const runPayload = {
      contextLabel: payload.contextLabel,
      expiresAt,
      generatedAt,
      id: crypto.randomUUID(),
      occasion: payload.occasion,
      recommendations,
    };

    for (const recommendation of recommendations) {
      await supabase.from('restaurant_ai_analyses').upsert(
        {
          analysis_version: ANALYSIS_VERSION,
          confidence: recommendation.confidence,
          evidence: {
            google_rating: recommendation.restaurant.rating,
            google_rating_count: recommendation.restaurant.ratingCount,
            used_google_reviews: recommendation.reviewSignals.length,
          },
          expires_at: analysisExpiresAt,
          generated_at: generatedAt,
          headline: recommendation.headline,
          matching_inventory_item_ids: recommendation.matchingInventoryItemIds,
          occasion: payload.occasion,
          provider_place_id: recommendation.providerPlaceId,
          reason: recommendation.reason,
          restaurant_id: recommendation.restaurantId,
          result_payload: recommendation,
          review_signals: recommendation.reviewSignals,
          role_label: recommendation.roleLabel,
          score: recommendation.score,
          strengths: recommendation.strengths,
          user_id: user.id,
          watchouts: recommendation.watchouts,
          wine_fit: recommendation.wineFit,
        },
        { onConflict: 'user_id,restaurant_id,occasion,analysis_version' }
      );
    }

    const { data: storedRun, error: runError } = await supabase
      .from('restaurant_recommendation_runs')
      .upsert(
        {
          analysis_version: ANALYSIS_VERSION,
          candidate_restaurant_ids: contexts.map((context) => context.row.id),
          center_lat: payload.center?.lat ?? null,
          center_lng: payload.center?.lng ?? null,
          context_label: payload.contextLabel,
          expires_at: expiresAt,
          filters: payload.filters,
          generated_at: generatedAt,
          occasion: payload.occasion,
          recommendation_payload: runPayload,
          request_hash: requestHash,
          user_id: user.id,
        },
        { onConflict: 'user_id,request_hash' }
      )
      .select('id')
      .single();

    if (runError || !storedRun?.id) {
      throw runError ?? new Error('KI-Auswahl konnte nicht gespeichert werden.');
    }

    const finalRun = {
      ...runPayload,
      id: storedRun.id,
    };

    await supabase
      .from('restaurant_recommendation_runs')
      .update({ recommendation_payload: finalRun })
      .eq('id', storedRun.id);

    return jsonResponse({ run: finalRun });
  } catch (error) {
    return errorResponse(error);
  }
});
