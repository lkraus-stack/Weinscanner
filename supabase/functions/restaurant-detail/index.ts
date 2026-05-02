import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  createServiceClient,
  errorResponse,
  handleCors,
  isRecord,
  jsonResponse,
  requirePost,
  requireUser,
} from '../_shared/http.ts';
import {
  getRestaurantWineProfile,
  type WineProfile,
} from '../_shared/wine-profile.ts';

type Coordinates = {
  lat: number;
  lng: number;
};

type RestaurantDetailRequest = {
  center?: Coordinates;
  provider?: 'fallback' | 'google_places';
  providerPlaceId?: string;
  restaurantId?: string;
};

type GooglePlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  id?: string;
  internationalPhoneNumber?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  photos?: Array<{ name?: string }>;
  priceLevel?: string;
  primaryType?: string;
  rating?: number;
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  reviews?: GoogleReview[];
  servesWine?: boolean;
  types?: string[];
  userRatingCount?: number;
  websiteUri?: string;
};

type GoogleReview = {
  originalText?: { text?: string };
  text?: { text?: string };
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
    openNow?: boolean;
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

type RestaurantQuality = {
  qualityLabel: 'Sehr gut' | 'Solide' | 'Top Qualität' | 'Wenig Daten';
  qualityScore: number;
  qualitySignals: string[];
};

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseCoordinates(value: unknown): Coordinates | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const lat = numberValue(value.lat);
  const lng = numberValue(value.lng);

  if (lat === null || lng === null) {
    return undefined;
  }

  return { lat, lng };
}

function parseRequest(value: unknown): RestaurantDetailRequest {
  if (!isRecord(value)) {
    throw new Error('Restaurant fehlt.');
  }

  const provider =
    value.provider === 'google_places' || value.provider === 'fallback'
      ? value.provider
      : undefined;

  return {
    center: parseCoordinates(value.center),
    provider,
    providerPlaceId: stringValue(value.providerPlaceId),
    restaurantId: stringValue(value.restaurantId),
  };
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(from: Coordinates, to: Coordinates) {
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

function formatCuisine(place: GooglePlace) {
  const types = [place.primaryType, ...(place.types ?? [])].filter(
    (value): value is string => typeof value === 'string'
  );

  if (types.includes('wine_bar')) {
    return 'Weinbar';
  }

  if (types.includes('fine_dining_restaurant')) {
    return 'Fine Dining';
  }

  if (types.includes('italian_restaurant')) {
    return 'Italienisch';
  }

  if (types.includes('french_restaurant')) {
    return 'Französisch';
  }

  if (types.includes('german_restaurant')) {
    return 'Deutsch';
  }

  if (types.includes('mediterranean_restaurant')) {
    return 'Mediterran';
  }

  if (types.includes('cafe')) {
    return 'Café';
  }

  if (types.includes('bar')) {
    return 'Bar';
  }

  if (types.includes('restaurant')) {
    return 'Restaurant';
  }

  return null;
}

function getQualityLabel(score: number, ratingCount: number | null) {
  if ((ratingCount ?? 0) < 8) {
    return 'Wenig Daten';
  }

  if (score >= 88) {
    return 'Top Qualität';
  }

  if (score >= 76) {
    return 'Sehr gut';
  }

  return 'Solide';
}

function getRestaurantQuality(
  row: RestaurantRow,
  center?: Coordinates
): RestaurantQuality {
  const location = {
    lat: Number(row.latitude),
    lng: Number(row.longitude),
  };
  const rating = row.rating ?? 3.7;
  const ratingCount = row.rating_count ?? 0;
  const distanceMeters = center ? getDistanceMeters(center, location) : 2500;
  const reviewScore = Math.min(Math.log10(Math.max(ratingCount, 1)) * 8, 22);
  const photoScore = row.photo_refs && row.photo_refs.length > 0 ? 5 : 0;
  const hoursScore = row.opening_hours?.weekdayDescriptions?.length ? 4 : 0;
  const openScore = row.opening_hours?.openNow === true ? 3 : 0;
  const typeScore =
    row.place_types?.some((type) =>
      [
        'fine_dining_restaurant',
        'italian_restaurant',
        'mediterranean_restaurant',
        'wine_bar',
      ].includes(type)
    ) ? 4 : 0;
  const distancePenalty = Math.min(distanceMeters, 12000) / 1200;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        rating * 13 +
          reviewScore +
          photoScore +
          hoursScore +
          openScore +
          typeScore -
          distancePenalty
      )
    )
  );
  const signals = [
    row.rating
      ? `${row.rating.toFixed(1).replace('.', ',')} Google Sterne`
      : null,
    ratingCount >= 50
      ? `${ratingCount} Bewertungen`
      : ratingCount > 0
        ? `${ratingCount} Bewertungen, noch wenig Daten`
        : 'Wenig öffentliche Bewertungsdaten',
    photoScore > 0 ? 'Restaurantfoto vorhanden' : null,
    hoursScore > 0 ? 'Öffnungszeiten verfügbar' : null,
    typeScore > 0 ? 'Klare Küchenrichtung' : null,
  ].filter((signal): signal is string => Boolean(signal)).slice(0, 4);

  return {
    qualityLabel: getQualityLabel(score, row.rating_count),
    qualityScore: score,
    qualitySignals: signals,
  };
}

function getReviewTexts(place: GooglePlace) {
  return (place.reviews ?? [])
    .slice(0, 5)
    .map((review) => review.text?.text ?? review.originalText?.text ?? null)
    .filter(
      (text): text is string =>
        typeof text === 'string' && Boolean(text.trim())
    );
}

function getGooglePlaceWineProfile(place: GooglePlace) {
  return getRestaurantWineProfile({
    cuisine: formatCuisine(place),
    name: place.displayName?.text ?? '',
    reviewTexts: getReviewTexts(place),
    servesWine: place.servesWine,
    types: place.types ?? [],
  });
}

function getRestaurantRowWineProfile(row: RestaurantRow) {
  return getRestaurantWineProfile({
    cuisine: row.cuisine,
    name: row.name,
    types: row.place_types ?? [],
  });
}

function getSourcePayload(place: GooglePlace) {
  return {
    detail_fetched_at: new Date().toISOString(),
    has_reviews: Array.isArray(place.reviews) && place.reviews.length > 0,
    review_count_used: Array.isArray(place.reviews)
      ? Math.min(place.reviews.length, 5)
      : 0,
    serves_wine: place.servesWine ?? null,
    source: 'google_places',
  };
}

function restaurantRowToResponse(
  row: RestaurantRow,
  center?: Coordinates,
  wineProfile?: WineProfile | null
) {
  const location = {
    lat: Number(row.latitude),
    lng: Number(row.longitude),
  };
  const photoRefs = row.photo_refs ?? [];
  const quality = getRestaurantQuality(row, center);
  const resolvedWineProfile =
    wineProfile === undefined ? getRestaurantRowWineProfile(row) : wineProfile;

  return {
    address: row.formatted_address,
    cuisine: row.cuisine,
    distanceMeters: center ? getDistanceMeters(center, location) : null,
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
    qualityLabel: quality.qualityLabel,
    qualityScore: quality.qualityScore,
    qualitySignals: quality.qualitySignals,
    rating: row.rating,
    ratingCount: row.rating_count,
    source: row.provider,
    types: row.place_types ?? [],
    websiteUrl: row.website_url,
    wineProfile: resolvedWineProfile,
  };
}

function normalizePlace(place: GooglePlace) {
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
            openNow:
              typeof place.regularOpeningHours.openNow === 'boolean'
                ? place.regularOpeningHours.openNow
                : null,
            weekdayDescriptions:
              place.regularOpeningHours.weekdayDescriptions ?? [],
          }
        : null,
    phone:
      place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null,
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
    source_payload: getSourcePayload(place),
    updated_at: new Date().toISOString(),
    website_url: place.websiteUri ?? null,
  };
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
          'id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,types,primaryType,regularOpeningHours,googleMapsUri,websiteUri,photos,internationalPhoneNumber,nationalPhoneNumber,reviews,servesWine',
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const place = (await response.json()) as GooglePlace;
  const restaurant = normalizePlace(place);

  return restaurant
    ? {
        restaurant,
        wineProfile: getGooglePlaceWineProfile(place),
      }
    : null;
}

serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  try {
    requirePost(req);
    await requireUser(req);

    const payload = parseRequest(await req.json());
    const supabase = createServiceClient();
    let restaurantQuery = supabase
      .from('restaurants')
      .select(
        'id, provider, provider_place_id, name, formatted_address, latitude, longitude, rating, rating_count, price_level, cuisine, google_maps_uri, opening_hours, phone, website_url, photo_refs, place_types'
      );

    if (payload.restaurantId) {
      restaurantQuery = restaurantQuery.eq('id', payload.restaurantId);
    } else if (payload.provider && payload.providerPlaceId) {
      restaurantQuery = restaurantQuery
        .eq('provider', payload.provider)
        .eq('provider_place_id', payload.providerPlaceId);
    } else {
      throw new Error('Restaurant-ID fehlt.');
    }

    const { data: cachedRestaurant, error: cachedError } =
      await restaurantQuery.maybeSingle();

    if (cachedError) {
      throw cachedError;
    }

    let restaurant = cachedRestaurant as RestaurantRow | null;
    let wineProfile: WineProfile | null | undefined;

    if (restaurant?.provider === 'google_places') {
      const googleDetails = await fetchGoogleDetails(
        restaurant.provider_place_id
      );

      if (googleDetails) {
        wineProfile = googleDetails.wineProfile;

        const { data: updatedRestaurant, error: updateError } = await supabase
          .from('restaurants')
          .upsert(googleDetails.restaurant, {
            onConflict: 'provider,provider_place_id',
          })
          .select(
            'id, provider, provider_place_id, name, formatted_address, latitude, longitude, rating, rating_count, price_level, cuisine, google_maps_uri, opening_hours, phone, website_url, photo_refs, place_types'
          )
          .single();

        if (!updateError && updatedRestaurant) {
          restaurant = updatedRestaurant as RestaurantRow;
        }
      }
    }

    if (!restaurant) {
      throw new Error('Restaurant nicht gefunden.');
    }

    return jsonResponse({
      restaurant: restaurantRowToResponse(
        restaurant,
        payload.center,
        wineProfile
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
});
