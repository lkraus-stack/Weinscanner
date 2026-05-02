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

type RestaurantSnapshot = {
  address: string | null;
  cuisine: string | null;
  googleMapsUri: string | null;
  isOpenNow: boolean | null;
  location: { lat: number; lng: number };
  name: string;
  openingHoursText: string[];
  phone: string | null;
  photoRefs: string[];
  priceLevel: string | null;
  provider: 'fallback' | 'google_places';
  providerPlaceId: string;
  rating: number | null;
  ratingCount: number | null;
  types: string[];
  websiteUrl: string | null;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseRestaurant(value: unknown): RestaurantSnapshot {
  if (!isRecord(value) || !isRecord(value.location)) {
    throw new Error('Restaurant fehlt.');
  }

  const lat = numberOrNull(value.location.lat);
  const lng = numberOrNull(value.location.lng);
  const name = stringOrNull(value.name);
  const provider =
    value.provider === 'google_places' || value.provider === 'fallback'
      ? value.provider
      : null;
  const providerPlaceId = stringOrNull(value.providerPlaceId) ?? stringOrNull(value.id);

  if (!name || !provider || !providerPlaceId || lat === null || lng === null) {
    throw new Error('Restaurant ist unvollständig.');
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Restaurant-Koordinaten sind ungültig.');
  }

  return {
    address: stringOrNull(value.address),
    cuisine: stringOrNull(value.cuisine),
    googleMapsUri: stringOrNull(value.googleMapsUri),
    isOpenNow:
      typeof value.isOpenNow === 'boolean' ? value.isOpenNow : null,
    location: { lat, lng },
    name,
    openingHoursText: Array.isArray(value.openingHoursText)
      ? value.openingHoursText.filter(
          (item): item is string => typeof item === 'string'
        )
      : [],
    phone: stringOrNull(value.phone),
    photoRefs: Array.isArray(value.photoRefs)
      ? value.photoRefs.filter(
          (item): item is string => typeof item === 'string'
        )
      : [],
    priceLevel: stringOrNull(value.priceLevel),
    provider,
    providerPlaceId,
    rating: numberOrNull(value.rating),
    ratingCount: numberOrNull(value.ratingCount),
    types: Array.isArray(value.types)
      ? value.types.filter((item): item is string => typeof item === 'string')
      : [],
    websiteUrl: stringOrNull(value.websiteUrl),
  };
}

serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  try {
    requirePost(req);
    const user = await requireUser(req);
    const body = await req.json();
    const restaurant = parseRestaurant(
      isRecord(body) ? body.restaurant : null
    );
    const shouldSave = isRecord(body) ? body.save !== false : true;
    const supabase = createServiceClient();
    const { data: restaurantRow, error: restaurantError } = await supabase
      .from('restaurants')
      .upsert(
        {
          cuisine: restaurant.cuisine,
          formatted_address: restaurant.address,
          google_maps_uri: restaurant.googleMapsUri,
          latitude: restaurant.location.lat,
          longitude: restaurant.location.lng,
          name: restaurant.name,
          opening_hours:
            restaurant.isOpenNow === null
              ? restaurant.openingHoursText.length > 0
                ? { weekdayDescriptions: restaurant.openingHoursText }
                : null
              : {
                  openNow: restaurant.isOpenNow,
                  weekdayDescriptions: restaurant.openingHoursText,
                },
          phone: restaurant.phone,
          photo_refs: restaurant.photoRefs,
          place_types: restaurant.types,
          price_level: restaurant.priceLevel,
          provider: restaurant.provider,
          provider_place_id: restaurant.providerPlaceId,
          rating: restaurant.rating,
          rating_count: restaurant.ratingCount,
          updated_at: new Date().toISOString(),
          website_url: restaurant.websiteUrl,
        },
        { onConflict: 'provider,provider_place_id' }
      )
      .select('id')
      .single();

    if (restaurantError || !restaurantRow?.id) {
      throw restaurantError ?? new Error('Restaurant konnte nicht gespeichert werden.');
    }

    if (shouldSave) {
      const { error: saveError } = await supabase
        .from('saved_restaurants')
        .upsert(
          {
            restaurant_id: restaurantRow.id,
            user_id: user.id,
          },
          { onConflict: 'user_id,restaurant_id' }
        );

      if (saveError) {
        throw saveError;
      }
    }

    return jsonResponse({
      restaurantId: restaurantRow.id,
      saved: shouldSave,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
