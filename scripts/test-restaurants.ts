import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getRestaurantWineProfile,
  type WineProfile,
} from '../supabase/functions/_shared/wine-profile';

type TestEnv = {
  RESTAURANT_TEST_EMAIL: string;
  RESTAURANT_TEST_PASSWORD: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
};

type Step = {
  label: string;
  ok: boolean;
};

type SearchRestaurant = {
  id: string;
  location: { lat: number; lng: number };
  name: string;
  provider?: string;
  providerPlaceId?: string;
  qualityLabel?: string | null;
  qualityScore?: number | null;
  qualitySignals?: string[];
  wineProfile?: WineProfile | null;
};

const ENV_PATH = resolve(process.cwd(), '.env.test');
const DEFAULT_TEST_EMAIL = 'restaurant-test@wine-scanner.dev';
const DEFAULT_TEST_PASSWORD = 'ChangeMeRestaurantTest123!';
const MUNICH_CENTER = { lat: 48.137154, lng: 11.576124 };

function record(steps: Step[], label: string, ok: boolean) {
  steps.push({ label, ok });
  console.log(`${steps.length}. ${label}: ${ok ? 'JA' : 'NEIN'}`);
}

function isWineProfile(value: unknown): value is WineProfile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const recordValue = value as Partial<WineProfile>;

  return (
    Array.isArray(recordValue.badges) &&
    typeof recordValue.hasSommelier === 'boolean' &&
    typeof recordValue.hasWineCard === 'boolean' &&
    typeof recordValue.isFullWineProfile === 'boolean' &&
    typeof recordValue.isWineBar === 'boolean' &&
    typeof recordValue.wineMentions === 'number' &&
    (recordValue.wineScore === 0 ||
      recordValue.wineScore === 1 ||
      recordValue.wineScore === 2 ||
      recordValue.wineScore === 3)
  );
}

function recordWineProfileKeywordTests(steps: Step[]) {
  const sommelier = getRestaurantWineProfile({
    name: 'Bistro Test',
    reviewTexts: ['Der Sommelier empfiehlt sehr gut.'],
  });
  const wineCard = getRestaurantWineProfile({
    name: 'Restaurant Test',
    reviewTexts: ['Tolle Weinkarte und breite Weinauswahl mit Wein.'],
  });
  const vinothek = getRestaurantWineProfile({
    name: 'Vinothek Altstadt',
    reviewTexts: [],
  });
  const wineBar = getRestaurantWineProfile({
    name: 'Central Wine Bar',
    reviewTexts: [],
  });
  const wineryMention = getRestaurantWineProfile({
    name: 'Gasthaus Test',
    reviewTexts: ['Regionale Flaschen direkt vom Weingut.'],
  });
  const emptyProfile = getRestaurantWineProfile({
    name: 'Cafe Test',
    reviewTexts: [],
  });

  record(
    steps,
    'WineProfile erkennt Sommelier-Signal',
    sommelier?.hasSommelier === true &&
      sommelier.badges.includes('Sommelier') &&
      sommelier.wineScore === 1
  );
  record(
    steps,
    'WineProfile erkennt Weinkarte und Weinauswahl',
    wineCard?.hasWineCard === true &&
      wineCard.badges.includes('Weinkarte') &&
      wineCard.wineScore === 2
  );
  record(
    steps,
    'WineProfile erkennt Vinothek als volles Weinprofil',
    vinothek?.isFullWineProfile === true &&
      vinothek.badges.includes('Vinothek') &&
      vinothek.wineScore === 3
  );
  record(
    steps,
    'WineProfile erkennt Wine Bar als Weinbar',
    wineBar?.isFullWineProfile === true &&
      wineBar.badges.includes('Weinbar') &&
      wineBar.wineScore === 3
  );
  record(
    steps,
    'WineProfile zählt Weingut als Wein-Erwähnung',
    wineryMention?.wineMentions === 1 && wineryMention.wineScore === 1
  );
  record(
    steps,
    'WineProfile bleibt ohne Wein-Signal leer',
    emptyProfile === null
  );
}

function parseEnvFile(contents: string): Partial<TestEnv> {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce<Partial<TestEnv>>((env, line) => {
      const separatorIndex = line.indexOf('=');

      if (separatorIndex === -1) {
        return env;
      }

      const key = line.slice(0, separatorIndex).trim() as keyof TestEnv;
      const value = line.slice(separatorIndex + 1).trim();

      env[key] = value;

      return env;
    }, {});
}

function loadEnv(): TestEnv {
  let rawEnv: string;

  try {
    rawEnv = readFileSync(ENV_PATH, 'utf8');
  } catch (error) {
    throw new Error(
      '.env.test fehlt. Bitte .env.test.example nach .env.test kopieren und echte Supabase-Testwerte eintragen.',
      { cause: error }
    );
  }

  const env = {
    RESTAURANT_TEST_EMAIL: DEFAULT_TEST_EMAIL,
    RESTAURANT_TEST_PASSWORD: DEFAULT_TEST_PASSWORD,
    ...parseEnvFile(rawEnv),
  };
  const requiredKeys: Array<keyof TestEnv> = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'RESTAURANT_TEST_EMAIL',
    'RESTAURANT_TEST_PASSWORD',
  ];
  const missingKeys = requiredKeys.filter((key) => !env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`.env.test ist unvollständig: ${missingKeys.join(', ')}`);
  }

  return env as TestEnv;
}

async function findUserByEmail(
  adminClient: SupabaseClient,
  email: string
): Promise<User | null> {
  let page = 1;

  while (page < 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find((candidate) => candidate.email === email);

    if (user) {
      return user;
    }

    if (data.users.length < 100) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function createOrUpdateTestUser(
  adminClient: SupabaseClient,
  email: string,
  password: string
) {
  const existingUser = await findUserByEmail(adminClient, email);

  if (existingUser) {
    const { data, error } = await adminClient.auth.admin.updateUserById(
      existingUser.id,
      {
        email_confirm: true,
        password,
      }
    );

    if (error) {
      throw error;
    }

    return data.user;
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });

  if (error) {
    throw error;
  }

  return data.user;
}

async function main() {
  const env = loadEnv();
  const steps: Step[] = [];
  const adminClient = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
  const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const user = await createOrUpdateTestUser(
    adminClient,
    env.RESTAURANT_TEST_EMAIL,
    env.RESTAURANT_TEST_PASSWORD
  );
  const { error: signInError } = await userClient.auth.signInWithPassword({
    email: env.RESTAURANT_TEST_EMAIL,
    password: env.RESTAURANT_TEST_PASSWORD,
  });

  if (signInError) {
    throw signInError;
  }

  record(steps, 'Restaurant-Testuser ist eingeloggt', true);
  recordWineProfileKeywordTests(steps);

  const { data: geocodeResult, error: geocodeError } =
    await userClient.functions.invoke('geocode-city', {
      body: { query: 'Augsburg' },
    });

  if (geocodeError) {
    throw geocodeError;
  }

  record(
    steps,
    'Stadtsuche löst Augsburg auf',
    typeof geocodeResult?.city?.label === 'string' &&
      Number.isFinite(geocodeResult?.city?.region?.latitude) &&
      Number.isFinite(geocodeResult?.city?.region?.longitude)
  );

  const { data: searchResult, error: searchError } =
    await userClient.functions.invoke('search-restaurants', {
      body: {
        bounds: {
          northEast: { lat: 48.177154, lng: 11.616124 },
          southWest: { lat: 48.097154, lng: 11.536124 },
        },
        center: MUNICH_CENTER,
        filters: {
          minRating: 4.2,
          openNow: false,
          qualityMode: 'smart',
          radiusMeters: 5000,
        },
      },
    });

  if (searchError) {
    throw searchError;
  }

  const restaurants = Array.isArray(searchResult?.data)
    ? (searchResult.data as SearchRestaurant[])
    : [];

  record(
    steps,
    'Restaurant-Suche liefert Daten oder leeres Fallback ohne Crash',
    Array.isArray(searchResult?.data)
  );

  record(
    steps,
    'Smart-Quality-Suche liefert Qualitätsfelder',
    restaurants.length === 0 ||
      restaurants.every(
        (item) =>
          typeof item.qualityScore === 'number' &&
          typeof item.qualityLabel === 'string' &&
          Array.isArray(item.qualitySignals)
      )
  );

  record(
    steps,
    'Restaurant-Suche liefert valide optionale Weinprofile',
    restaurants.every(
      (item) =>
        item.wineProfile === undefined ||
        item.wineProfile === null ||
        isWineProfile(item.wineProfile)
    )
  );

  const { data: strictSearchResult, error: strictSearchError } =
    await userClient.functions.invoke('search-restaurants', {
      body: {
        bounds: {
          northEast: { lat: 48.177154, lng: 11.616124 },
          southWest: { lat: 48.097154, lng: 11.536124 },
        },
        center: MUNICH_CENTER,
        filters: {
          openNow: false,
          qualityMode: 'strict',
          radiusMeters: 1000,
        },
      },
    });

  if (strictSearchError) {
    throw strictSearchError;
  }

  record(
    steps,
    'Strenge Umkreissuche bleibt stabil',
    Array.isArray(strictSearchResult?.data)
  );

  const radiusResults = await Promise.all(
    [1000, 3000, 5000, 10000, 25000].map((radiusMeters) =>
      userClient.functions.invoke('search-restaurants', {
        body: {
          bounds: {
            northEast: { lat: 48.177154, lng: 11.616124 },
            southWest: { lat: 48.097154, lng: 11.536124 },
          },
          center: MUNICH_CENTER,
          filters: {
            openNow: false,
            qualityMode: 'smart',
            radiusMeters,
          },
        },
      })
    )
  );

  const radiusSearchesAreStable = radiusResults.every(
    ({ data, error }) => !error && Array.isArray(data?.data)
  );

  record(
    steps,
    'Alle Umkreisfilter bleiben stabil',
    radiusSearchesAreStable
  );

  const restaurant =
    restaurants[0] ??
    ({
      address: 'Viktualienmarkt 15, 80331 München',
      cuisine: 'Bayerisch, Weinbar',
      distanceMeters: 420,
      googleMapsUri:
        'https://www.google.com/maps/search/?api=1&query=Viktualienmarkt%20M%C3%BCnchen',
      id: 'fallback-viktualienmarkt-smoke',
      isOpenNow: true,
      location: { lat: 48.13503, lng: 11.57628 },
      name: 'Weinort am Viktualienmarkt Smoke',
      openingHoursText: [],
      photoRefs: [],
      photoUrl: null,
      priceLevel: 'Mittel',
      provider: 'fallback',
      providerPlaceId: 'fallback-viktualienmarkt-smoke',
      qualityLabel: 'Sehr gut',
      qualityScore: 86,
      qualitySignals: ['Smoke-Test Qualität'],
      rating: 4.6,
      ratingCount: 312,
      source: 'fallback',
      types: ['restaurant', 'wine_bar'],
      wineProfile: {
        badges: ['Weinbar'],
        hasSommelier: false,
        hasWineCard: false,
        isFullWineProfile: true,
        isWineBar: true,
        wineMentions: 1,
        wineScore: 3,
      },
    } satisfies Record<string, unknown>);

  const { data: savedResult, error: saveError } =
    await userClient.functions.invoke('save-restaurant', {
      body: { restaurant, save: true },
    });

  if (saveError || !savedResult?.restaurantId) {
    throw saveError ?? new Error('save-restaurant hat keine ID geliefert.');
  }

  const restaurantId = savedResult.restaurantId as string;
  record(steps, 'Restaurant kann gemerkt werden', true);

  const { data: detailResult, error: detailError } =
    await userClient.functions.invoke('restaurant-detail', {
      body: { center: MUNICH_CENTER, restaurantId },
    });

  if (detailError) {
    throw detailError;
  }

  record(
    steps,
    'Restaurant-Detail liefert gecachte oder Google-Daten',
    typeof detailResult?.restaurant?.name === 'string' &&
      typeof detailResult?.restaurant?.location?.lat === 'number' &&
      typeof detailResult?.restaurant?.qualityScore === 'number'
  );

  const { data: savedRows, error: savedRowsError } = await userClient
    .from('saved_restaurants')
    .select('id')
    .eq('restaurant_id', restaurantId);

  if (savedRowsError) {
    throw savedRowsError;
  }

  record(
    steps,
    'Gemerkter Restaurant-Eintrag ist user-scoped lesbar',
    (savedRows ?? []).length === 1
  );

  const { error: ratingError } = await userClient
    .from('restaurant_ratings')
    .upsert(
      {
        notes: 'Smoke-Test Bewertung',
        overall_stars: 5,
        restaurant_id: restaurantId,
        user_id: user.id,
        visited_at: new Date().toISOString(),
        wine_stars: 4,
      },
      { onConflict: 'user_id,restaurant_id' }
    );

  if (ratingError) {
    throw ratingError;
  }

  record(steps, 'Restaurantbewertung speichert Gesamt- und Wein-Sterne', true);

  const { error: visitWithoutWineError } = await userClient
    .from('restaurant_visits')
    .insert({
      notes: 'Smoke-Test Besuch ohne Wein',
      restaurant_id: restaurantId,
      user_id: user.id,
      visited_at: new Date().toISOString(),
    });

  if (visitWithoutWineError) {
    throw visitWithoutWineError;
  }

  record(steps, 'Restaurantbesuch kann ohne Wein gespeichert werden', true);

  const { data: inventoryItem } = await userClient
    .from('inventory_items')
    .select('id, quantity, vintage_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (inventoryItem?.id) {
    const beforeQuantity = inventoryItem.quantity;
    const { error: visitWithWineError } = await userClient
      .from('restaurant_visits')
      .insert({
        inventory_item_id: inventoryItem.id,
        notes: 'Smoke-Test Besuch mit Wein',
        restaurant_id: restaurantId,
        user_id: user.id,
        visited_at: new Date().toISOString(),
        vintage_id: inventoryItem.vintage_id,
      });

    if (visitWithWineError) {
      throw visitWithWineError;
    }

    const { data: inventoryAfter, error: inventoryAfterError } =
      await userClient
        .from('inventory_items')
        .select('quantity')
        .eq('id', inventoryItem.id)
        .single();

    if (inventoryAfterError) {
      throw inventoryAfterError;
    }

    record(
      steps,
      'Besuch mit Inventory-Wein verändert die Menge nicht',
      inventoryAfter.quantity === beforeQuantity
    );
  } else {
    record(
      steps,
      'Besuch mit Inventory-Wein übersprungen, weil Testuser keinen Bestand hat',
      true
    );
  }

  const failedSteps = steps.filter((step) => !step.ok);

  if (failedSteps.length > 0) {
    throw new Error(
      `Restaurant-Smoke-Test fehlgeschlagen: ${failedSteps
        .map((step) => step.label)
        .join(', ')}`
    );
  }

  console.log('Restaurant-Smoke-Test erfolgreich.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
