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

type Coordinates = {
  lat: number;
  lng: number;
};

type SearchRestaurantsRequest = {
  bounds: {
    northEast: Coordinates;
    southWest: Coordinates;
  };
  center: Coordinates;
  filters?: {
    cuisineTypes?: string[];
    minRating?: number;
    openNow?: boolean;
    radiusMeters?: number;
  };
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
  types?: string[];
  userRatingCount?: number;
  websiteUri?: string;
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

const SUPPORTED_CUISINE_TYPES = new Set([
  'bar',
  'cafe',
  'fine_dining_restaurant',
  'french_restaurant',
  'german_restaurant',
  'italian_restaurant',
  'mediterranean_restaurant',
  'restaurant',
  'wine_bar',
]);

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseCoordinates(value: unknown): Coordinates | null {
  if (!isRecord(value)) {
    return null;
  }

  const lat = numberValue(value.lat);
  const lng = numberValue(value.lng);

  if (lat === null || lng === null) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { lat, lng };
}

function parseRequest(value: unknown): SearchRestaurantsRequest {
  if (!isRecord(value) || !isRecord(value.bounds)) {
    throw new Error('Ungültige Restaurant-Suche.');
  }

  const center = parseCoordinates(value.center);
  const northEast = parseCoordinates(value.bounds.northEast);
  const southWest = parseCoordinates(value.bounds.southWest);

  if (!center || !northEast || !southWest) {
    throw new Error('Kartenbereich fehlt.');
  }

  const filters = isRecord(value.filters)
    ? {
        cuisineTypes: Array.isArray(value.filters.cuisineTypes)
          ? value.filters.cuisineTypes.filter(
              (item): item is string =>
                typeof item === 'string' &&
                SUPPORTED_CUISINE_TYPES.has(item)
            )
          : undefined,
        minRating: numberValue(value.filters.minRating) ?? undefined,
        openNow:
          typeof value.filters.openNow === 'boolean'
            ? value.filters.openNow
            : undefined,
        radiusMeters: numberValue(value.filters.radiusMeters) ?? undefined,
      }
    : undefined;

  return {
    bounds: { northEast, southWest },
    center,
    filters,
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

function getRadiusMeters(request: SearchRestaurantsRequest) {
  if (request.filters?.radiusMeters) {
    return Math.min(Math.max(request.filters.radiusMeters, 1000), 50000);
  }

  const northEastDistance = getDistanceMeters(
    request.center,
    request.bounds.northEast
  );
  const southWestDistance = getDistanceMeters(
    request.center,
    request.bounds.southWest
  );

  return Math.min(Math.max(northEastDistance, southWestDistance, 1200), 50000);
}

async function hashQuery(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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

function restaurantRowToResponse(row: RestaurantRow, center: Coordinates) {
  const location = {
    lat: Number(row.latitude),
    lng: Number(row.longitude),
  };

  return {
    address: row.formatted_address,
    cuisine: row.cuisine,
    distanceMeters: getDistanceMeters(center, location),
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
    photoRefs: row.photo_refs ?? [],
    photoUrl:
      row.photo_refs && row.photo_refs.length > 0
        ? `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/restaurant-photo?name=${encodeURIComponent(row.photo_refs[0])}`
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
      .slice(0, 6),
    place_types: place.types ?? [],
    price_level: formatPriceLevel(place.priceLevel),
    provider: 'google_places',
    provider_place_id: place.id,
    rating: typeof place.rating === 'number' ? place.rating : null,
    rating_count:
      typeof place.userRatingCount === 'number'
        ? place.userRatingCount
        : null,
    source_payload: place,
    website_url: place.websiteUri ?? null,
  };
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
    const queryHash = await hashQuery({
      bounds: payload.bounds,
      center: payload.center,
      filters: payload.filters ?? {},
      provider: 'google_places',
    });
    const nowIso = new Date().toISOString();
    const { data: cachedSearch } = await supabase
      .from('restaurant_search_cache')
      .select('restaurant_ids')
      .eq('query_hash', queryHash)
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (
      Array.isArray(cachedSearch?.restaurant_ids) &&
      cachedSearch.restaurant_ids.length > 0
    ) {
      const { data: cachedRestaurants, error: cachedRestaurantsError } =
        await supabase
          .from('restaurants')
          .select(
            'id, provider, provider_place_id, name, formatted_address, latitude, longitude, rating, rating_count, price_level, cuisine, google_maps_uri, opening_hours, phone, website_url, photo_refs, place_types'
          )
          .in('id', cachedSearch.restaurant_ids);

      if (!cachedRestaurantsError && Array.isArray(cachedRestaurants)) {
        const byId = new Map(
          (cachedRestaurants as RestaurantRow[]).map((restaurant) => [
            restaurant.id,
            restaurant,
          ])
        );

        return jsonResponse({
          data: cachedSearch.restaurant_ids
            .map((id: string) => byId.get(id))
            .filter((restaurant): restaurant is RestaurantRow =>
              Boolean(restaurant)
            )
            .map((restaurant) =>
              restaurantRowToResponse(restaurant, payload.center)
            ),
          source: 'google_places',
        });
      }
    }

    const googlePlacesKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

    if (!googlePlacesKey) {
      return jsonResponse({ data: [], source: 'fallback' });
    }

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        body: JSON.stringify({
          includedTypes:
            payload.filters?.cuisineTypes &&
            payload.filters.cuisineTypes.length > 0
              ? payload.filters.cuisineTypes
              : ['restaurant'],
          languageCode: 'de',
          locationRestriction: {
            circle: {
              center: {
                latitude: payload.center.lat,
                longitude: payload.center.lng,
              },
              radius: getRadiusMeters(payload),
            },
          },
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googlePlacesKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.primaryType,places.regularOpeningHours,places.googleMapsUri,places.websiteUri,places.photos,places.internationalPhoneNumber,places.nationalPhoneNumber',
        },
        method: 'POST',
      }
    );

    if (!response.ok) {
      throw new Error('Google Places konnte nicht geladen werden.');
    }

    const body = await response.json();
    const places = Array.isArray(body.places) ? body.places : [];
    const restaurantRows = places
      .map(normalizePlace)
      .filter((place): place is NonNullable<ReturnType<typeof normalizePlace>> =>
        Boolean(place)
      );

    if (restaurantRows.length === 0) {
      return jsonResponse({ data: [], source: 'fallback' });
    }

    const { data: storedRestaurants, error: storeError } = await supabase
      .from('restaurants')
      .upsert(restaurantRows, { onConflict: 'provider,provider_place_id' })
      .select(
        'id, provider, provider_place_id, name, formatted_address, latitude, longitude, rating, rating_count, price_level, cuisine, google_maps_uri, opening_hours, phone, website_url, photo_refs, place_types'
      );

    if (storeError || !Array.isArray(storedRestaurants)) {
      throw storeError ?? new Error('Restaurants konnten nicht gespeichert werden.');
    }

    const restaurants = (storedRestaurants as RestaurantRow[])
      .filter((restaurant) => {
        const radiusMeters = payload.filters?.radiusMeters;

        if (!radiusMeters) {
          return true;
        }

        return (
          getDistanceMeters(payload.center, {
            lat: Number(restaurant.latitude),
            lng: Number(restaurant.longitude),
          }) <= radiusMeters
        );
      })
      .filter((restaurant) =>
        payload.filters?.minRating
          ? (restaurant.rating ?? 0) >= payload.filters.minRating
          : true
      )
      .filter((restaurant) =>
        payload.filters?.openNow
          ? restaurant.opening_hours?.openNow !== false
          : true
      );

    await supabase.from('restaurant_search_cache').upsert(
      {
        bounds: payload.bounds,
        center_lat: payload.center.lat,
        center_lng: payload.center.lng,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        filters: payload.filters ?? {},
        provider: 'google_places',
        query_hash: queryHash,
        restaurant_ids: restaurants.map((restaurant) => restaurant.id),
      },
      { onConflict: 'query_hash' }
    );

    return jsonResponse({
      data: restaurants.map((restaurant) =>
        restaurantRowToResponse(restaurant, payload.center)
      ),
      source: 'google_places',
    });
  } catch (error) {
    return errorResponse(error);
  }
});
