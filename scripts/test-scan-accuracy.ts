import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { uploadBuffer } from '../src/lib/storage';

type TestEnv = {
  SCAN_ACCURACY_IMAGE_PATH?: string;
  SCAN_ACCURACY_TEST_EMAIL?: string;
  SCAN_ACCURACY_TEST_PASSWORD?: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
};

type ScanWineResult = {
  extraction?: {
    grape_variety?: string | null;
    vintage_year?: number | null;
  };
  minimal?: {
    grape_variety?: string | null;
    producer?: string;
    vintage_year?: number | null;
    wine_name?: string;
  };
  source: 'cache' | 'fresh' | 'low_confidence' | 'needs_more_info';
  wine?: {
    grape_variety?: string | null;
    producer?: string;
    wine_name?: string;
  };
};

const ENV_PATH = resolve(process.cwd(), '.env.test');
const DEFAULT_IMAGE_PATH =
  '/Users/lukas/Downloads/WhatsApp Image 2026-04-30 at 17.02.47.jpeg';
const DEFAULT_TEST_EMAIL = 'scan-accuracy-test@wine-scanner.dev';
const DEFAULT_TEST_PASSWORD = 'ChangeMeScanAccuracyTest123!';
const BUCKET_NAME = 'wine-labels';

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
    SCAN_ACCURACY_IMAGE_PATH: DEFAULT_IMAGE_PATH,
    SCAN_ACCURACY_TEST_EMAIL: DEFAULT_TEST_EMAIL,
    SCAN_ACCURACY_TEST_PASSWORD: DEFAULT_TEST_PASSWORD,
    ...parseEnvFile(readFileSync(ENV_PATH, 'utf8')),
  };
  const missingKeys = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ].filter((key) => !env[key as keyof TestEnv]);

  if (missingKeys.length > 0) {
    throw new Error(`.env.test ist unvollständig: ${missingKeys.join(', ')}`);
  }

  return env as TestEnv;
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
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

function assertNoWrongWine(result: ScanWineResult) {
  const values = [
    result.minimal?.wine_name,
    result.minimal?.grape_variety,
    result.wine?.wine_name,
    result.wine?.grape_variety,
    result.extraction?.grape_variety,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  if (values.some((value) => value.includes('sirmian'))) {
    throw new Error('Regression: Scan wurde als Sirmian erkannt.');
  }

  if (values.some((value) => value.includes('pinot bianco'))) {
    throw new Error('Regression: Scan wurde als Pinot Bianco erkannt.');
  }
}

function assertExpectedWineOrNeedsMoreInfo(result: ScanWineResult) {
  if (result.source === 'needs_more_info' || result.source === 'low_confidence') {
    return;
  }

  const wineName = `${result.minimal?.wine_name ?? ''} ${
    result.wine?.wine_name ?? ''
  }`.toLowerCase();
  const grapeVariety = `${result.minimal?.grape_variety ?? ''} ${
    result.wine?.grape_variety ?? ''
  } ${result.extraction?.grape_variety ?? ''}`.toLowerCase();
  const vintageYear =
    result.minimal?.vintage_year ?? result.extraction?.vintage_year ?? null;

  if (!wineName.includes('magred')) {
    throw new Error(`Erwartet Magred oder needs_more_info, erhalten: ${wineName}`);
  }

  if (!grapeVariety.includes('chardonnay')) {
    throw new Error(
      `Erwartet Chardonnay oder needs_more_info, erhalten: ${grapeVariety}`
    );
  }

  if (vintageYear !== 2024) {
    throw new Error(`Erwartet Jahrgang 2024, erhalten: ${vintageYear}`);
  }
}

async function run() {
  const env = loadEnv();
  const adminClient = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  const testUser = await createOrUpdateTestUser(
    adminClient,
    env.SCAN_ACCURACY_TEST_EMAIL ?? DEFAULT_TEST_EMAIL,
    env.SCAN_ACCURACY_TEST_PASSWORD ?? DEFAULT_TEST_PASSWORD
  );
  const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data: signInData, error: signInError } =
    await anonClient.auth.signInWithPassword({
      email: env.SCAN_ACCURACY_TEST_EMAIL ?? DEFAULT_TEST_EMAIL,
      password: env.SCAN_ACCURACY_TEST_PASSWORD ?? DEFAULT_TEST_PASSWORD,
    });

  if (signInError || !signInData.session) {
    throw signInError ?? new Error('Anon-Login hat keine Session geliefert.');
  }

  const imageBuffer = readFileSync(
    resolve(env.SCAN_ACCURACY_IMAGE_PATH ?? DEFAULT_IMAGE_PATH)
  );
  const upload = await uploadBuffer(
    testUser.id,
    toArrayBuffer(imageBuffer),
    `scan-accuracy-magred-${Date.now()}.jpg`,
    anonClient
  );

  try {
    const response = await fetch(`${env.SUPABASE_URL}/functions/v1/scan-wine`, {
      body: JSON.stringify({
        imageUrl: upload.signedUrl,
      }),
      headers: {
        Authorization: `Bearer ${signInData.session.access_token}`,
        apikey: env.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `scan-wine returned ${response.status} ${response.statusText}: ${responseText}`
      );
    }

    const result = JSON.parse(responseText) as ScanWineResult;

    assertNoWrongWine(result);
    assertExpectedWineOrNeedsMoreInfo(result);
    console.log(JSON.stringify(result, null, 2));
    console.log('PASS');
  } finally {
    await adminClient.storage.from(BUCKET_NAME).remove([upload.storagePath]);
    await adminClient.auth.admin.deleteUser(testUser.id);
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  console.log('FAIL');
  process.exitCode = 1;
});
