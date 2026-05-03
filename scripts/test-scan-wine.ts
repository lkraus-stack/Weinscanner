import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';

import { uploadBuffer } from '../src/lib/storage';

type Step = {
  label: string;
  ok: boolean;
};

type TestEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SCAN_WINE_TEST_EMAIL: string;
  SCAN_WINE_TEST_PASSWORD: string;
  SCAN_WINE_PRIMARY_IMAGE_PATH?: string;
  SCAN_WINE_NO_VINTAGE_IMAGE_PATH?: string;
  SCAN_WINE_NO_VINTAGE_IMAGE_URL?: string;
  SCAN_WINE_SECOND_IMAGE_PATH?: string;
  SCAN_WINE_SECOND_IMAGE_URL?: string;
  SCAN_WINE_CLEANUP_TERMS?: string;
  EXTRACT_WINE_TEST_EMAIL?: string;
  EXTRACT_WINE_TEST_PASSWORD?: string;
  EXTRACT_WINE_TEST_IMAGE_URL?: string;
  EXTRACT_WINE_TEST_LOCAL_IMAGE_PATH?: string;
};

type ScanWineResult = {
  minimal?: {
    estimated_vintage_year?: number | null;
    estimated_vintage_year_reason?: string | null;
    producer?: string;
    vintage_year?: number | null;
    wine_name?: string;
  };
  source: 'cache' | 'fresh' | 'low_confidence' | 'needs_more_info';
  wine?: { id?: string; producer?: string; wine_name?: string };
};

const ENV_PATH = resolve(process.cwd(), '.env.test');
const BUCKET_NAME = 'wine-labels';
const DEFAULT_TEST_EMAIL = 'scan-cache-test@wine-scanner.dev';
const DEFAULT_TEST_PASSWORD = 'ChangeMeScanCacheTest123!';
const DEFAULT_CLEANUP_TERMS: string[] = [];

function record(steps: Step[], label: string, ok: boolean) {
  steps.push({ label, ok });
  console.log(`${steps.length}. ${label}: ${ok ? 'JA' : 'NEIN'}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const parsedEnv = parseEnvFile(rawEnv);
  const env = {
    SCAN_WINE_TEST_EMAIL:
      parsedEnv.SCAN_WINE_TEST_EMAIL ??
      parsedEnv.EXTRACT_WINE_TEST_EMAIL ??
      DEFAULT_TEST_EMAIL,
    SCAN_WINE_TEST_PASSWORD:
      parsedEnv.SCAN_WINE_TEST_PASSWORD ??
      parsedEnv.EXTRACT_WINE_TEST_PASSWORD ??
      DEFAULT_TEST_PASSWORD,
    ...parsedEnv,
  };
  const requiredKeys: Array<keyof TestEnv> = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SCAN_WINE_TEST_EMAIL',
    'SCAN_WINE_TEST_PASSWORD',
  ];
  const missingKeys = requiredKeys.filter((key) => !env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`.env.test ist unvollständig: ${missingKeys.join(', ')}`);
  }

  if (!getPrimaryImagePath(env as TestEnv)) {
    throw new Error(
      '.env.test braucht SCAN_WINE_PRIMARY_IMAGE_PATH oder EXTRACT_WINE_TEST_LOCAL_IMAGE_PATH.'
    );
  }

  if (!getSecondImagePath(env as TestEnv) && !getSecondImageUrl(env as TestEnv)) {
    throw new Error(
      '.env.test braucht SCAN_WINE_SECOND_IMAGE_PATH, SCAN_WINE_SECOND_IMAGE_URL oder EXTRACT_WINE_TEST_IMAGE_URL.'
    );
  }

  return env as TestEnv;
}

function getPrimaryImagePath(env: TestEnv) {
  return env.SCAN_WINE_PRIMARY_IMAGE_PATH ?? env.EXTRACT_WINE_TEST_LOCAL_IMAGE_PATH;
}

function getSecondImageUrl(env: TestEnv) {
  return env.SCAN_WINE_SECOND_IMAGE_URL ?? env.EXTRACT_WINE_TEST_IMAGE_URL;
}

function getSecondImagePath(env: TestEnv) {
  return env.SCAN_WINE_SECOND_IMAGE_PATH;
}

function getNoVintageImageUrl(env: TestEnv) {
  return env.SCAN_WINE_NO_VINTAGE_IMAGE_URL;
}

function getNoVintageImagePath(env: TestEnv) {
  return env.SCAN_WINE_NO_VINTAGE_IMAGE_PATH;
}

function getCleanupTerms(env: TestEnv) {
  return (
    env.SCAN_WINE_CLEANUP_TERMS?.split(',')
      .map((term) => term.trim())
      .filter(Boolean) ?? DEFAULT_CLEANUP_TERMS
  );
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

function readLocalImageAsJpegBuffer(localImagePath: string) {
  const extension = extname(localImagePath).toLowerCase();

  if (extension === '.jpg' || extension === '.jpeg') {
    return readFileSync(localImagePath);
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'wine-scan-test-'));
  const outputPath = join(tempDir, `${basename(localImagePath, extension)}.jpg`);

  try {
    execFileSync(
      'sips',
      ['-s', 'format', 'jpeg', localImagePath, '--out', outputPath],
      {
        stdio: 'ignore',
      }
    );

    return readFileSync(outputPath);
  } finally {
    rmSync(tempDir, {
      force: true,
      recursive: true,
    });
  }
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

async function cleanupMatchingWines(
  adminClient: SupabaseClient,
  terms: string[]
) {
  const deletedIds: string[] = [];

  if (terms.length === 0) {
    return deletedIds;
  }

  for (const term of terms) {
    const { data: matches, error: selectError } = await adminClient
      .from('wines')
      .select('id, producer, wine_name')
      .or(`producer.ilike.%${term}%,wine_name.ilike.%${term}%`);

    if (selectError) {
      throw selectError;
    }

    const ids = (matches ?? []).map((match) => match.id);

    if (ids.length === 0) {
      continue;
    }

    const safeIds: string[] = [];

    for (const id of ids) {
      if (await isWineUnreferenced(adminClient, id)) {
        safeIds.push(id);
      } else {
        console.warn(
          `Cleanup überspringt referenzierten Wein ${id} für Suchbegriff "${term}".`
        );
      }
    }

    if (safeIds.length === 0) {
      continue;
    }

    const { error: deleteError } = await adminClient
      .from('wines')
      .delete()
      .in('id', safeIds);

    if (deleteError) {
      console.warn(`Cleanup konnte Weine für "${term}" nicht löschen:`, deleteError);
      continue;
    }

    deletedIds.push(...safeIds);
  }

  return deletedIds;
}

async function isWineUnreferenced(adminClient: SupabaseClient, wineId: string) {
  const { data: vintages, error: vintagesError } = await adminClient
    .from('vintages')
    .select('id')
    .eq('wine_id', wineId);

  if (vintagesError) {
    throw vintagesError;
  }

  const vintageIds = (vintages ?? []).map((vintage) => vintage.id);

  if (vintageIds.length === 0) {
    return true;
  }

  for (const tableName of ['scans', 'ratings', 'inventory_items']) {
    const { data, error } = await adminClient
      .from(tableName)
      .select('id')
      .in('vintage_id', vintageIds)
      .limit(1);

    if (error) {
      throw error;
    }

    if ((data ?? []).length > 0) {
      return false;
    }
  }

  return true;
}

async function deleteInsertedWines(
  adminClient: SupabaseClient,
  wineIds: string[]
) {
  const uniqueIds = [...new Set(wineIds)].filter(Boolean);

  if (uniqueIds.length === 0) {
    return;
  }

  const { error } = await adminClient.from('wines').delete().in('id', uniqueIds);

  if (error) {
    console.warn('Test-Cleanup konnte frisch erkannte Weine nicht löschen:', error);
  }
}

async function prepareLocalImageUrl(
  userId: string,
  anonClient: SupabaseClient,
  imagePath: string,
  prefix: string
) {
  const localImagePath = resolve(process.cwd(), imagePath);
  const imageBuffer = readLocalImageAsJpegBuffer(localImagePath);
  const uploadResult = await uploadBuffer(
    userId,
    toArrayBuffer(imageBuffer),
    `${prefix}-${Date.now()}.jpg`,
    anonClient
  );

  return uploadResult;
}

async function invokeScanWine(
  env: TestEnv,
  accessToken: string,
  imageUrl: string
): Promise<ScanWineResult> {
  let lastErrorText = '';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${env.SUPABASE_URL}/functions/v1/scan-wine`, {
      body: JSON.stringify({
        imageUrl,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: env.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const responseText = await response.text();

    if (response.ok) {
      return JSON.parse(responseText) as ScanWineResult;
    }

    lastErrorText = `scan-wine returned ${response.status} ${response.statusText}: ${responseText}`;

    if ([408, 429, 500, 502, 503, 504].includes(response.status) && attempt < 4) {
      await sleep(2000 * (attempt + 1));
      continue;
    }

    break;
  }

  throw new Error(lastErrorText);
}

async function cleanup(
  adminClient: SupabaseClient,
  userId: string | null,
  storagePaths: string[],
  insertedWineIds: string[]
) {
  if (storagePaths.length > 0) {
    await adminClient.storage.from(BUCKET_NAME).remove(storagePaths);
  }

  await deleteInsertedWines(adminClient, insertedWineIds);

  if (userId) {
    await adminClient.auth.admin.deleteUser(userId);
  }
}

function printMissingSteps(steps: Step[]) {
  const printedLabels = new Set(steps.map((step) => step.label));
  const expectedLabels = [
    '.env.test geladen',
    'Admin-Client erstellt',
    'Cache-Testdaten bereinigt',
    'Test-User erstellt oder gefunden',
    'Anon-Login erfolgreich',
    'Primäres Testbild hochgeladen',
    'Erster Lauf liefert Wein',
    'Zweiter Lauf liefert denselben Wein',
    'Anderes Bild liefert Wein',
    'Cleanup erfolgreich',
  ];

  expectedLabels
    .filter((label) => !printedLabels.has(label))
    .forEach((label) => record(steps, label, false));
}

async function runScanWineTest() {
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

    await cleanupMatchingWines(adminClient, getCleanupTerms(env));
    record(steps, 'Cache-Testdaten bereinigt', true);

    testUser = await createOrUpdateTestUser(
      adminClient,
      env.SCAN_WINE_TEST_EMAIL,
      env.SCAN_WINE_TEST_PASSWORD
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
        email: env.SCAN_WINE_TEST_EMAIL,
        password: env.SCAN_WINE_TEST_PASSWORD,
      });

    if (signInError || !signInData.session) {
      throw signInError ?? new Error('Anon-Login hat keine Session geliefert.');
    }

    record(steps, 'Anon-Login erfolgreich', true);

    const primaryImage = await prepareLocalImageUrl(
      testUser.id,
      anonClient,
      getPrimaryImagePath(env) ?? '',
      'scan-cache-primary'
    );
    uploadedStoragePaths.push(primaryImage.storagePath);
    record(steps, 'Primäres Testbild hochgeladen', true);

    const firstResult = await invokeScanWine(
      env,
      signInData.session.access_token,
      primaryImage.signedUrl
    );
    const firstHasWine =
      firstResult.source !== 'low_confidence' && Boolean(firstResult.wine?.id);

    if (firstResult.source === 'fresh' && firstResult.wine?.id) {
      insertedWineIds.push(firstResult.wine.id);
    }

    record(steps, 'Erster Lauf liefert Wein', firstHasWine);

    if (!firstHasWine) {
      throw new Error(`Erster Lauf war ${firstResult.source}, erwartet Wein.`);
    }

    const secondResult = await invokeScanWine(
      env,
      signInData.session.access_token,
      primaryImage.signedUrl
    );
    const secondIsStable =
      secondResult.source !== 'low_confidence' &&
      Boolean(secondResult.wine?.id) &&
      secondResult.wine?.id === firstResult.wine?.id &&
      (firstResult.source === 'cache' || secondResult.source === 'cache');

    record(steps, 'Zweiter Lauf liefert denselben Wein', secondIsStable);

    if (!secondIsStable) {
      throw new Error(
        `Zweiter Lauf war ${secondResult.source}, erwartet stabilen Cache-Treffer.`
      );
    }

    let otherWineUrl = getSecondImageUrl(env) ?? '';
    const secondImagePath = getSecondImagePath(env);

    if (secondImagePath) {
      const secondImage = await prepareLocalImageUrl(
        testUser.id,
        anonClient,
        secondImagePath,
        'scan-cache-second'
      );
      uploadedStoragePaths.push(secondImage.storagePath);
      otherWineUrl = secondImage.signedUrl;
    }

    const thirdResult = await invokeScanWine(
      env,
      signInData.session.access_token,
      otherWineUrl
    );
    const thirdWasHandled =
      thirdResult.source === 'low_confidence' ||
      thirdResult.source === 'needs_more_info' ||
      Boolean(thirdResult.wine?.id);

    if (thirdResult.source === 'fresh' && thirdResult.wine?.id) {
      insertedWineIds.push(thirdResult.wine.id);
    }

    record(
      steps,
      'Anderes Bild liefert Wein oder kontrollierte Unsicherheit',
      thirdWasHandled
    );

    if (!thirdWasHandled) {
      throw new Error(
        `Anderes Bild war ${thirdResult.source}, erwartet Wein oder kontrollierte Unsicherheit.`
      );
    }

    let noVintageUrl = getNoVintageImageUrl(env) ?? '';
    const noVintageImagePath = getNoVintageImagePath(env);

    if (noVintageImagePath) {
      const noVintageImage = await prepareLocalImageUrl(
        testUser.id,
        anonClient,
        noVintageImagePath,
        'scan-cache-no-vintage'
      );
      uploadedStoragePaths.push(noVintageImage.storagePath);
      noVintageUrl = noVintageImage.signedUrl;
    }

    if (noVintageUrl) {
      const noVintageResult = await invokeScanWine(
        env,
        signInData.session.access_token,
        noVintageUrl
      );
      const minimal = noVintageResult.minimal;
      const hasEstimateOrCleanFallback =
        Boolean(minimal) &&
        minimal?.vintage_year === null &&
        (typeof minimal?.estimated_vintage_year === 'number' ||
          minimal?.estimated_vintage_year === null);

      if (noVintageResult.source === 'fresh' && noVintageResult.wine?.id) {
        insertedWineIds.push(noVintageResult.wine.id);
      }

      record(
        steps,
        'Bild ohne sichtbaren Jahrgang liefert Schätzung oder null-Fallback',
        hasEstimateOrCleanFallback
      );

      if (!hasEstimateOrCleanFallback) {
        throw new Error(
          'No-vintage-Test hat keinen sauberen estimated_vintage_year-Fallback geliefert.'
        );
      }

      console.log('Kein sichtbarer Jahrgang:', JSON.stringify(noVintageResult, null, 2));
    } else {
      console.log(
        'No-vintage-Schätzungstest übersprungen. Setze SCAN_WINE_NO_VINTAGE_IMAGE_PATH oder SCAN_WINE_NO_VINTAGE_IMAGE_URL in .env.test.'
      );
    }

    console.log('Erster Lauf:', JSON.stringify(firstResult, null, 2));
    console.log('Zweiter Lauf:', JSON.stringify(secondResult, null, 2));
    console.log('Anderer Wein:', JSON.stringify(thirdResult, null, 2));

    await cleanup(adminClient, testUser.id, uploadedStoragePaths, insertedWineIds);
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

void runScanWineTest();
