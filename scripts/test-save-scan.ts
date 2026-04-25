import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { uploadBuffer } from '../src/lib/storage';

type Step = {
  label: string;
  ok: boolean;
};

type TestEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SAVE_SCAN_TEST_EMAIL: string;
  SAVE_SCAN_TEST_PASSWORD: string;
};

type SaveScanPayload = {
  corrections?: Array<{ field: string; ai_value: string; user_value: string }>;
  imageUrl?: string;
  selectedVintageYear: number;
  source: 'cache' | 'fresh' | 'manual';
  storagePath: string;
  vintageData: Record<string, unknown>;
  wineData: Record<string, unknown>;
  wineId?: string;
};

type SaveScanResult = {
  scanId: string;
  wineId: string;
  vintageId: string;
};

const ENV_PATH = resolve(process.cwd(), '.env.test');
const BUCKET_NAME = 'wine-labels';
const DEFAULT_TEST_EMAIL = 'save-scan-test@wine-scanner.dev';
const DEFAULT_TEST_PASSWORD = 'ChangeMeSaveScanTest123!';
const INLINE_TEST_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Ap//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z';

function record(steps: Step[], label: string, ok: boolean) {
  steps.push({ label, ok });
  console.log(`${steps.length}. ${label}: ${ok ? 'JA' : 'NEIN'}`);
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
    SAVE_SCAN_TEST_EMAIL: DEFAULT_TEST_EMAIL,
    SAVE_SCAN_TEST_PASSWORD: DEFAULT_TEST_PASSWORD,
    ...parseEnvFile(rawEnv),
  };
  const requiredKeys: Array<keyof TestEnv> = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SAVE_SCAN_TEST_EMAIL',
    'SAVE_SCAN_TEST_PASSWORD',
  ];
  const missingKeys = requiredKeys.filter((key) => !env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`.env.test ist unvollständig: ${missingKeys.join(', ')}`);
  }

  return env as TestEnv;
}

function getFixtureArrayBuffer(): ArrayBuffer {
  const fixtureBuffer = Buffer.from(INLINE_TEST_JPEG_BASE64, 'base64');

  return fixtureBuffer.buffer.slice(
    fixtureBuffer.byteOffset,
    fixtureBuffer.byteOffset + fixtureBuffer.byteLength
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

async function invokeSaveScan(
  env: TestEnv,
  accessToken: string,
  payload: SaveScanPayload
): Promise<SaveScanResult> {
  const response = await fetch(`${env.SUPABASE_URL}/functions/v1/save-scan`, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `save-scan returned ${response.status} ${response.statusText}: ${responseText}`
    );
  }

  return JSON.parse(responseText) as SaveScanResult;
}

async function uploadTestImage(
  anonClient: SupabaseClient,
  userId: string,
  prefix: string
) {
  return uploadBuffer(
    userId,
    getFixtureArrayBuffer(),
    `${prefix}-${Date.now()}.jpg`,
    anonClient
  );
}

function buildManualPayload(storagePath: string, imageUrl: string): SaveScanPayload {
  return {
    corrections: [
      {
        ai_value: 'KI Estate',
        field: 'producer',
        user_value: 'Sprint Save Estate',
      },
    ],
    imageUrl,
    selectedVintageYear: 2024,
    source: 'manual',
    storagePath,
    vintageData: {
      ai_confidence: 0.91,
      alcohol_percent: 12.5,
      aromas: ['Apfel', 'Zitrus'],
      data_sources: ['https://example.com/save-scan-test'],
      description_long: 'Testbeschreibung fuer den atomaren Save-Flow.',
      description_short: 'Testwein fuer Sprint 09.',
      drinking_window_end: 2030,
      drinking_window_start: 2025,
      food_pairing: 'Gebratener Fisch',
      price_max_eur: 15,
      price_min_eur: 10,
      serving_temperature: '10-12 °C',
      vinification: 'Edelstahl',
    },
    wineData: {
      alcohol_percent: 12.5,
      appellation: 'Test DOC',
      country: 'Deutschland',
      grape_variety: 'Riesling',
      producer: 'Sprint Save Estate',
      region: 'Testregion',
      taste_dryness: 'trocken',
      wine_color: 'weiss',
      wine_name: 'Atomic Test',
    },
  };
}

function buildCachePayload(
  storagePath: string,
  imageUrl: string,
  wineId: string
): SaveScanPayload {
  return {
    imageUrl,
    selectedVintageYear: 2025,
    source: 'cache',
    storagePath,
    vintageData: {
      ai_confidence: 0.88,
      alcohol_percent: 12.7,
      aromas: ['Birne', 'Mineralik'],
      data_sources: ['https://example.com/cache-save-test'],
      description_short: 'Zweiter Jahrgang im Cache-Save-Test.',
      drinking_window_end: 2031,
      drinking_window_start: 2026,
      serving_temperature: '10-12 °C',
    },
    wineData: {
      producer: 'Soll nicht global schreiben',
      wine_name: 'Soll nicht global schreiben',
    },
    wineId,
  };
}

async function validateManualSave(
  adminClient: SupabaseClient,
  userId: string,
  result: SaveScanResult,
  storagePath: string
) {
  const { data: scan, error: scanError } = await adminClient
    .from('scans')
    .select('id, user_id, vintage_id, label_image_url')
    .eq('id', result.scanId)
    .single();

  if (scanError) {
    throw scanError;
  }

  const { data: vintage, error: vintageError } = await adminClient
    .from('vintages')
    .select('id, wine_id, vintage_year, aromas')
    .eq('id', result.vintageId)
    .single();

  if (vintageError) {
    throw vintageError;
  }

  const { data: wine, error: wineError } = await adminClient
    .from('wines')
    .select('id, producer, wine_name')
    .eq('id', result.wineId)
    .single();

  if (wineError) {
    throw wineError;
  }

  const { data: feedback, error: feedbackError } = await adminClient
    .from('ai_feedback')
    .select('id, scan_id, field, ai_value, user_value')
    .eq('scan_id', result.scanId);

  if (feedbackError) {
    throw feedbackError;
  }

  return (
    scan.user_id === userId &&
    scan.vintage_id === result.vintageId &&
    scan.label_image_url === storagePath &&
    vintage.wine_id === result.wineId &&
    vintage.vintage_year === 2024 &&
    wine.producer === 'Sprint Save Estate' &&
    wine.wine_name === 'Atomic Test' &&
    (feedback ?? []).some(
      (entry) =>
        entry.field === 'producer' &&
        entry.ai_value === 'KI Estate' &&
        entry.user_value === 'Sprint Save Estate'
    )
  );
}

async function validateCacheSave(
  adminClient: SupabaseClient,
  userId: string,
  result: SaveScanResult,
  wineId: string,
  storagePath: string
) {
  const { data: scan, error: scanError } = await adminClient
    .from('scans')
    .select('id, user_id, vintage_id, label_image_url')
    .eq('id', result.scanId)
    .single();

  if (scanError) {
    throw scanError;
  }

  const { data: vintage, error: vintageError } = await adminClient
    .from('vintages')
    .select('id, wine_id, vintage_year')
    .eq('id', result.vintageId)
    .single();

  if (vintageError) {
    throw vintageError;
  }

  const { data: wine, error: wineError } = await adminClient
    .from('wines')
    .select('producer, wine_name')
    .eq('id', wineId)
    .single();

  if (wineError) {
    throw wineError;
  }

  return (
    result.wineId === wineId &&
    scan.user_id === userId &&
    scan.vintage_id === result.vintageId &&
    scan.label_image_url === storagePath &&
    vintage.wine_id === wineId &&
    vintage.vintage_year === 2025 &&
    wine.producer === 'Sprint Save Estate' &&
    wine.wine_name === 'Atomic Test'
  );
}

async function cleanup(
  adminClient: SupabaseClient,
  userId: string | null,
  storagePaths: string[],
  wineIds: string[]
) {
  if (userId) {
    const { data: scans } = await adminClient
      .from('scans')
      .select('id')
      .eq('user_id', userId);
    const scanIds = (scans ?? []).map((scan) => scan.id);

    if (scanIds.length > 0) {
      await adminClient.from('ai_feedback').delete().in('scan_id', scanIds);
      await adminClient.from('scans').delete().in('id', scanIds);
    }
  }

  const uniqueWineIds = [...new Set(wineIds)].filter(Boolean);

  if (uniqueWineIds.length > 0) {
    await adminClient.from('wines').delete().in('id', uniqueWineIds);
  }

  if (storagePaths.length > 0) {
    await adminClient.storage.from(BUCKET_NAME).remove(storagePaths);
  }

  if (userId) {
    await adminClient.auth.admin.deleteUser(userId);
  }
}

function printMissingSteps(steps: Step[]) {
  const printedLabels = new Set(steps.map((step) => step.label));
  const expectedLabels = [
    '.env.test geladen',
    'Admin-Client erstellt',
    'Test-User erstellt oder gefunden',
    'Anon-Login erfolgreich',
    'Testbilder hochgeladen',
    'save-scan manual erfolgreich',
    'DB-Zeilen und ai_feedback validiert',
    'save-scan cache erfolgreich',
    'Cache-Save nutzt bestehenden Wein',
    'Cleanup erfolgreich',
  ];

  expectedLabels
    .filter((label) => !printedLabels.has(label))
    .forEach((label) => record(steps, label, false));
}

async function runSaveScanTest() {
  const steps: Step[] = [];
  let adminClient: SupabaseClient | null = null;
  let testUser: User | null = null;
  const uploadedStoragePaths: string[] = [];
  const insertedWineIds: string[] = [];

  try {
    const env = loadEnv();
    record(steps, '.env.test geladen', true);

    adminClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    record(steps, 'Admin-Client erstellt', true);

    testUser = await createOrUpdateTestUser(
      adminClient,
      env.SAVE_SCAN_TEST_EMAIL,
      env.SAVE_SCAN_TEST_PASSWORD
    );
    record(steps, 'Test-User erstellt oder gefunden', Boolean(testUser?.id));

    const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data: signInData, error: signInError } =
      await anonClient.auth.signInWithPassword({
        email: env.SAVE_SCAN_TEST_EMAIL,
        password: env.SAVE_SCAN_TEST_PASSWORD,
      });

    if (signInError || !signInData.session) {
      throw signInError ?? new Error('Anon-Login hat keine Session geliefert.');
    }

    record(steps, 'Anon-Login erfolgreich', true);

    const firstImage = await uploadTestImage(
      anonClient,
      testUser.id,
      'save-scan-manual'
    );
    const secondImage = await uploadTestImage(
      anonClient,
      testUser.id,
      'save-scan-cache'
    );
    uploadedStoragePaths.push(firstImage.storagePath, secondImage.storagePath);
    record(steps, 'Testbilder hochgeladen', true);

    const manualResult = await invokeSaveScan(
      env,
      signInData.session.access_token,
      buildManualPayload(firstImage.storagePath, firstImage.signedUrl)
    );
    insertedWineIds.push(manualResult.wineId);
    record(steps, 'save-scan manual erfolgreich', Boolean(manualResult.scanId));

    const manualDbValid = await validateManualSave(
      adminClient,
      testUser.id,
      manualResult,
      firstImage.storagePath
    );
    record(steps, 'DB-Zeilen und ai_feedback validiert', manualDbValid);

    if (!manualDbValid) {
      throw new Error('Manual-Save wurde nicht korrekt persistiert.');
    }

    const cacheResult = await invokeSaveScan(
      env,
      signInData.session.access_token,
      buildCachePayload(
        secondImage.storagePath,
        secondImage.signedUrl,
        manualResult.wineId
      )
    );
    record(steps, 'save-scan cache erfolgreich', Boolean(cacheResult.scanId));

    const cacheDbValid = await validateCacheSave(
      adminClient,
      testUser.id,
      cacheResult,
      manualResult.wineId,
      secondImage.storagePath
    );
    record(steps, 'Cache-Save nutzt bestehenden Wein', cacheDbValid);

    if (!cacheDbValid) {
      throw new Error('Cache-Save hat den bestehenden Wein nicht korrekt genutzt.');
    }

    console.log('Manual Save:', JSON.stringify(manualResult, null, 2));
    console.log('Cache Save:', JSON.stringify(cacheResult, null, 2));

    await cleanup(
      adminClient,
      testUser.id,
      uploadedStoragePaths,
      insertedWineIds
    );
    uploadedStoragePaths.length = 0;
    insertedWineIds.length = 0;
    record(steps, 'Cleanup erfolgreich', true);

    console.log('PASS');
  } catch (error) {
    if (adminClient) {
      try {
        await cleanup(
          adminClient,
          testUser?.id ?? null,
          uploadedStoragePaths,
          insertedWineIds
        );
      } catch (cleanupError) {
        console.error('Cleanup-Fehler:', cleanupError);
      }
    }

    printMissingSteps(steps);
    console.error(error instanceof Error ? error.stack : error);
    console.log('FAIL');
    process.exitCode = 1;
  }
}

void runSaveScanTest();
