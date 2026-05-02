import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
};

const ENV_PATH = resolve(process.cwd(), '.env.test');
const DEFAULT_TEST_EMAIL = 'restaurant-test@wine-scanner.dev';
const DEFAULT_TEST_PASSWORD = 'ChangeMeRestaurantTest123!';
const MUNICH_CENTER = { lat: 48.137154, lng: 11.576124 };

function record(steps: Step[], label: string, ok: boolean) {
  steps.push({ label, ok });
  console.log(`${steps.length}. ${label}: ${ok ? 'JA' : 'NEIN'}`);
}

async function readFunctionError(error: unknown) {
  const context =
    typeof error === 'object' && error !== null && 'context' in error
      ? (error.context as unknown)
      : null;

  if (context instanceof Response) {
    const body = await context.text();

    return `Status ${context.status}: ${body}`;
  }

  return error instanceof Error ? error.message : String(error);
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
  const env = {
    RESTAURANT_TEST_EMAIL: DEFAULT_TEST_EMAIL,
    RESTAURANT_TEST_PASSWORD: DEFAULT_TEST_PASSWORD,
    ...parseEnvFile(readFileSync(ENV_PATH, 'utf8')),
  };
  const missingKeys = (
    [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'RESTAURANT_TEST_EMAIL',
      'RESTAURANT_TEST_PASSWORD',
    ] as Array<keyof TestEnv>
  ).filter((key) => !env[key]);

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

  record(steps, 'KI-Restaurant-Testuser ist eingeloggt', true);

  const { data: searchResult, error: searchError } =
    await userClient.functions.invoke('search-restaurants', {
      body: {
        bounds: {
          northEast: { lat: 48.177154, lng: 11.616124 },
          southWest: { lat: 48.097154, lng: 11.536124 },
        },
        center: MUNICH_CENTER,
        filters: { minRating: 4, openNow: false, radiusMeters: 5000 },
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
    'Restaurant-Kandidaten für KI sind vorhanden',
    restaurants.length > 0
  );

  const { data: runResult, error: runError } =
    await userClient.functions.invoke('analyze-restaurants', {
      body: {
        center: MUNICH_CENTER,
        contextLabel: 'München · Schöner Abend · 5 km',
        filters: { minRating: 4, openNow: false, radiusMeters: 5000 },
        occasion: 'nice_evening',
        restaurants: restaurants.slice(0, 5),
      },
    });

  if (runError) {
    console.error(await readFunctionError(runError));
    throw runError;
  }

  const recommendations = Array.isArray(runResult?.run?.recommendations)
    ? runResult.run.recommendations
    : [];
  const firstRecommendation = recommendations[0];

  record(
    steps,
    'KI-Analyse liefert Top-Empfehlungen',
    typeof runResult?.run?.id === 'string' &&
      recommendations.length > 0 &&
      typeof firstRecommendation?.score === 'number'
  );

  const { data: cachedResult, error: cachedError } =
    await userClient.functions.invoke('analyze-restaurants', {
      body: {
        center: MUNICH_CENTER,
        contextLabel: 'München · Schöner Abend · 5 km',
        filters: { minRating: 4, openNow: false, radiusMeters: 5000 },
        occasion: 'nice_evening',
        restaurants: restaurants.slice(0, 5),
      },
    });

  if (cachedError) {
    console.error(await readFunctionError(cachedError));
    throw cachedError;
  }

  record(
    steps,
    'KI-Run wird aus Cache wiederverwendet',
    cachedResult?.run?.id === runResult?.run?.id
  );

  const { data: storedRun, error: storedRunError } = await userClient
    .from('restaurant_recommendation_runs')
    .select('id')
    .eq('id', runResult.run.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (storedRunError) {
    throw storedRunError;
  }

  record(steps, 'KI-Run ist user-scoped gespeichert', Boolean(storedRun?.id));

  const { data: analyses, error: analysesError } = await userClient
    .from('restaurant_ai_analyses')
    .select('id, result_payload')
    .eq('user_id', user.id)
    .limit(3);

  if (analysesError) {
    throw analysesError;
  }

  record(
    steps,
    'Restaurant-Analysen speichern keine Rohreviews als Top-Level-Feld',
    (analyses ?? []).every((analysis) => {
      const payload = analysis.result_payload;

      return (
        typeof payload === 'object' &&
        payload !== null &&
        !Array.isArray(payload) &&
        !('reviews' in payload)
      );
    })
  );

  const failedSteps = steps.filter((step) => !step.ok);

  if (failedSteps.length > 0) {
    throw new Error(
      `KI-Restaurant-Test fehlgeschlagen: ${failedSteps
        .map((step) => step.label)
        .join(', ')}`
    );
  }

  console.log('KI-Restaurant-Smoke-Test erfolgreich.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
