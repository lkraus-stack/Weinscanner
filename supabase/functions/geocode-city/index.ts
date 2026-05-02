import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  errorResponse,
  handleCors,
  isRecord,
  jsonResponse,
  requirePost,
  requireUser,
} from '../_shared/http.ts';

type KnownCity = {
  aliases: string[];
  label: string;
  region: {
    latitude: number;
    latitudeDelta: number;
    longitude: number;
    longitudeDelta: number;
  };
};

type GeocodeAddressComponent = {
  long_name?: string;
  types?: string[];
};

type GeocodeResult = {
  address_components?: GeocodeAddressComponent[];
  formatted_address?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  types?: string[];
};

const KNOWN_CITIES: KnownCity[] = [
  {
    aliases: ['augsburg'],
    label: 'Augsburg',
    region: {
      latitude: 48.3705,
      latitudeDelta: 0.08,
      longitude: 10.8978,
      longitudeDelta: 0.08,
    },
  },
  {
    aliases: ['muenchen', 'munich', 'münchen'],
    label: 'München',
    region: {
      latitude: 48.137154,
      latitudeDelta: 0.08,
      longitude: 11.576124,
      longitudeDelta: 0.08,
    },
  },
  {
    aliases: ['wien', 'vienna'],
    label: 'Wien',
    region: {
      latitude: 48.2082,
      latitudeDelta: 0.08,
      longitude: 16.3738,
      longitudeDelta: 0.08,
    },
  },
  {
    aliases: ['zuerich', 'zurich', 'zürich'],
    label: 'Zürich',
    region: {
      latitude: 47.3769,
      latitudeDelta: 0.08,
      longitude: 8.5417,
      longitudeDelta: 0.08,
    },
  },
  {
    aliases: ['berlin'],
    label: 'Berlin',
    region: {
      latitude: 52.52,
      latitudeDelta: 0.1,
      longitude: 13.405,
      longitudeDelta: 0.1,
    },
  },
  {
    aliases: ['hamburg'],
    label: 'Hamburg',
    region: {
      latitude: 53.5511,
      latitudeDelta: 0.1,
      longitude: 9.9937,
      longitudeDelta: 0.1,
    },
  },
];

function getKnownCity(query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase('de-DE');

  return KNOWN_CITIES.find((city) =>
    city.aliases.some((alias) => alias === normalizedQuery)
  );
}

function getQuery(value: unknown) {
  if (!isRecord(value) || typeof value.query !== 'string') {
    throw new Error('Stadt fehlt.');
  }

  const query = value.query.trim();

  if (query.length < 2) {
    throw new Error('Stadt ist zu kurz.');
  }

  return query;
}

function hasType(result: GeocodeResult, type: string) {
  return Array.isArray(result.types) && result.types.includes(type);
}

function getAddressComponent(result: GeocodeResult, types: string[]) {
  const components = Array.isArray(result.address_components)
    ? result.address_components
    : [];

  return components.find((component) =>
    types.some((type) => component.types?.includes(type))
  )?.long_name;
}

function getPreferredResult(results: GeocodeResult[]) {
  return (
    results.find((result) => hasType(result, 'locality')) ??
    results.find((result) => hasType(result, 'postal_town')) ??
    results.find((result) => hasType(result, 'administrative_area_level_3')) ??
    results[0]
  );
}

function getCityLabel(result: GeocodeResult) {
  return (
    getAddressComponent(result, [
      'locality',
      'postal_town',
      'administrative_area_level_3',
      'administrative_area_level_2',
    ]) ??
    result.formatted_address?.split(',')[0] ??
    'Ausgewählter Ort'
  );
}

serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  try {
    requirePost(req);
    await requireUser(req);

    const query = getQuery(await req.json());
    const knownCity = getKnownCity(query);

    if (knownCity) {
      return jsonResponse({ city: knownCity });
    }

    const googlePlacesKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

    if (!googlePlacesKey) {
      throw new Error('Stadtsuche ist noch nicht konfiguriert.');
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query);
    url.searchParams.set('language', 'de');
    url.searchParams.set('region', 'de');
    url.searchParams.set('key', googlePlacesKey);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Stadt konnte nicht geladen werden.');
    }

    const data = await response.json();
    const results: GeocodeResult[] = Array.isArray(data.results)
      ? data.results
      : [];
    const result = getPreferredResult(results);
    const location = result?.geometry?.location;

    if (
      !result?.formatted_address ||
      typeof location?.lat !== 'number' ||
      typeof location.lng !== 'number'
    ) {
      throw new Error('Stadt wurde nicht gefunden.');
    }

    return jsonResponse({
      city: {
        label: getCityLabel(result),
        region: {
          latitude: location.lat,
          latitudeDelta: 0.08,
          longitude: location.lng,
          longitudeDelta: 0.08,
        },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
