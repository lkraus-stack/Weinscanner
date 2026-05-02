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
  HISTORY_OTHER_TEST_EMAIL: string;
  HISTORY_OTHER_TEST_PASSWORD: string;
  HISTORY_TEST_EMAIL: string;
  HISTORY_TEST_PASSWORD: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
};

type HistoryRow = {
  country: string | null;
  grape_variety: string | null;
  label_image_path: string | null;
  producer: string | null;
  region: string | null;
  scan_id: string;
  scanned_at: string;
  vintage_id: string | null;
  vintage_year: number | null;
  wine_color: string | null;
  wine_id: string | null;
  wine_name: string | null;
};

const ENV_PATH = resolve(process.cwd(), '.env.test');
const BUCKET_NAME = 'wine-labels';
const DEFAULT_TEST_EMAIL = 'history-test@wine-scanner.dev';
const DEFAULT_TEST_PASSWORD = 'ChangeMeHistoryTest123!';
const DEFAULT_OTHER_EMAIL = 'history-other-test@wine-scanner.dev';
const DEFAULT_OTHER_PASSWORD = 'ChangeMeHistoryOtherTest123!';
const INLINE_TEST_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Ap//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z';
const WINE_COLORS = ['weiss', 'rot', 'rose', 'schaum', 'suess'] as const;

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

  const env = {
    HISTORY_OTHER_TEST_EMAIL: DEFAULT_OTHER_EMAIL,
    HISTORY_OTHER_TEST_PASSWORD: DEFAULT_OTHER_PASSWORD,
    HISTORY_TEST_EMAIL: DEFAULT_TEST_EMAIL,
    HISTORY_TEST_PASSWORD: DEFAULT_TEST_PASSWORD,
    ...parseEnvFile(rawEnv),
  };
  const requiredKeys: Array<keyof TestEnv> = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'HISTORY_TEST_EMAIL',
    'HISTORY_TEST_PASSWORD',
    'HISTORY_OTHER_TEST_EMAIL',
    'HISTORY_OTHER_TEST_PASSWORD',
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

async function signIn(
  env: TestEnv,
  email: string,
  password: string
) {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw error ?? new Error('Login hat keine Session geliefert.');
  }

  return { client, session: data.session };
}

async function invokeSaveScan(
  env: TestEnv,
  accessToken: string,
  storagePath: string,
  index: number
) {
  const color = WINE_COLORS[index % WINE_COLORS.length];
  const body = JSON.stringify({
    selectedVintageYear: 2025 - (index % 5),
    source: 'manual',
    storagePath,
    vintageData: {
      ai_confidence: 0.9,
      alcohol_percent: 12 + (index % 3),
      aromas: ['Apfel', 'Mineralik'],
      data_sources: ['https://example.com/history-test'],
      description_short: 'History-Testwein',
      drinking_window_end: 2030,
      drinking_window_start: 2026,
      serving_temperature: '10-12 °C',
    },
    wineData: {
      appellation: 'History DOC',
      country: 'Deutschland',
      grape_variety: index % 2 === 0 ? 'Riesling' : 'Spätburgunder',
      producer: `History Estate ${String(index).padStart(2, '0')}`,
      region: index % 3 === 0 ? 'Mosel' : 'Pfalz',
      taste_dryness: 'trocken',
      wine_color: color,
      wine_name: `Chronik Test ${String(index).padStart(2, '0')}`,
    },
  });
  let lastErrorText = '';

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${env.SUPABASE_URL}/functions/v1/save-scan`, {
      body,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: env.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const responseText = await response.text();

    if (response.ok) {
      return JSON.parse(responseText) as {
        scanId: string;
        vintageId: string;
        wineId: string;
      };
    }

    lastErrorText = `save-scan returned ${response.status} ${response.statusText}: ${responseText}`;

    if ([408, 429, 500, 502, 503, 504].includes(response.status) && attempt < 3) {
      await sleep(1000 * (attempt + 1));
      continue;
    }

    break;
  }

  throw new Error(lastErrorText);
}

async function invokeDraftSaveScan(
  env: TestEnv,
  accessToken: string,
  storagePath: string
) {
  const response = await fetch(`${env.SUPABASE_URL}/functions/v1/save-scan`, {
    body: JSON.stringify({
      corrections: [],
      selectedVintageYear: null,
      source: 'draft',
      storagePath,
      vintageData: {},
      wineData: {},
    }),
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
      `draft save-scan returned ${response.status} ${response.statusText}: ${responseText}`
    );
  }

  return JSON.parse(responseText) as {
    scanId: string;
    vintageId: string | null;
    wineId: string | null;
  };
}

async function queryHistory(
  client: SupabaseClient,
  args: {
    pageLimit?: number;
    pageOffset?: number;
    searchQuery?: string;
    wineColor?: string;
  }
) {
  const { data, error } = await client.rpc('get_user_scan_history', {
    page_limit: args.pageLimit ?? 20,
    page_offset: args.pageOffset ?? 0,
    search_query: args.searchQuery,
    wine_color_filter: args.wineColor,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as HistoryRow[];
}

async function cleanup(
  adminClient: SupabaseClient,
  userIds: string[],
  storagePaths: string[],
  wineIds: string[]
) {
  for (const userId of userIds) {
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

  for (const userId of userIds) {
    await adminClient.auth.admin.deleteUser(userId);
  }
}

function printMissingSteps(steps: Step[]) {
  const printedLabels = new Set(steps.map((step) => step.label));
  const expectedLabels = [
    '.env.test geladen',
    'Admin-Client erstellt',
    'Test-User erstellt oder gefunden',
    'Anon-Logins erfolgreich',
    'Testbild hochgeladen',
    '25 Scans ueber save-scan erstellt',
    'Draft-Scan im Verlauf sichtbar',
    'Page 1 und Page 2 paginieren korrekt',
    'Suche trifft Producer, Wein und Region',
    'Weinfarben-Filter trifft korrekt',
    'Fremder User sieht keine Scans',
    'Cleanup erfolgreich',
  ];

  expectedLabels
    .filter((label) => !printedLabels.has(label))
    .forEach((label) => record(steps, label, false));
}

async function runHistoryTest() {
  const steps: Step[] = [];
  let adminClient: SupabaseClient | null = null;
  const userIds: string[] = [];
  const storagePaths: string[] = [];
  const wineIds: string[] = [];

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

    const testUser = await createOrUpdateTestUser(
      adminClient,
      env.HISTORY_TEST_EMAIL,
      env.HISTORY_TEST_PASSWORD
    );
    const otherUser = await createOrUpdateTestUser(
      adminClient,
      env.HISTORY_OTHER_TEST_EMAIL,
      env.HISTORY_OTHER_TEST_PASSWORD
    );
    userIds.push(testUser.id, otherUser.id);
    record(steps, 'Test-User erstellt oder gefunden', true);

    const { client, session } = await signIn(
      env,
      env.HISTORY_TEST_EMAIL,
      env.HISTORY_TEST_PASSWORD
    );
    const { client: otherClient } = await signIn(
      env,
      env.HISTORY_OTHER_TEST_EMAIL,
      env.HISTORY_OTHER_TEST_PASSWORD
    );
    record(steps, 'Anon-Logins erfolgreich', true);

    const upload = await uploadBuffer(
      testUser.id,
      getFixtureArrayBuffer(),
      `history-${Date.now()}.jpg`,
      client
    );
    storagePaths.push(upload.storagePath);
    record(steps, 'Testbild hochgeladen', true);

    for (let index = 0; index < 25; index += 1) {
      const result = await invokeSaveScan(
        env,
        session.access_token,
        upload.storagePath,
        index
      );
      wineIds.push(result.wineId);
    }

    record(steps, '25 Scans ueber save-scan erstellt', true);

    const draftResult = await invokeDraftSaveScan(
      env,
      session.access_token,
      upload.storagePath
    );
    const draftRows = await queryHistory(client, { pageLimit: 50, pageOffset: 0 });
    const draftVisible = draftRows.some(
      (row) =>
        row.scan_id === draftResult.scanId &&
        row.vintage_id === null &&
        row.wine_id === null
    );
    record(steps, 'Draft-Scan im Verlauf sichtbar', draftVisible);

    if (!draftVisible) {
      throw new Error('Draft-Scan fehlt im Verlauf.');
    }

    const pageOne = await queryHistory(client, { pageLimit: 20, pageOffset: 0 });
    const pageTwo = await queryHistory(client, { pageLimit: 20, pageOffset: 20 });
    const paginationOk =
      pageOne.length === 20 &&
      pageTwo.length === 6 &&
      new Set([...pageOne, ...pageTwo].map((row) => row.scan_id)).size === 26;
    record(steps, 'Page 1 und Page 2 paginieren korrekt', paginationOk);

    if (!paginationOk) {
      throw new Error('History-Pagination ist nicht korrekt.');
    }

    const producerSearch = await queryHistory(client, {
      searchQuery: 'History Estate 07',
    });
    const wineSearch = await queryHistory(client, {
      searchQuery: 'Chronik Test 12',
    });
    const regionSearch = await queryHistory(client, { searchQuery: 'Mosel' });
    const searchOk =
      producerSearch.some((row) => row.producer === 'History Estate 07') &&
      wineSearch.some((row) => row.wine_name === 'Chronik Test 12') &&
      regionSearch.length > 0 &&
      regionSearch.every((row) => row.region === 'Mosel');
    record(steps, 'Suche trifft Producer, Wein und Region', searchOk);

    if (!searchOk) {
      throw new Error('History-Suche trifft nicht korrekt.');
    }

    const whiteRows = await queryHistory(client, { wineColor: 'weiss' });
    const colorOk =
      whiteRows.length > 0 &&
      whiteRows.every((row) => row.wine_color === 'weiss');
    record(steps, 'Weinfarben-Filter trifft korrekt', colorOk);

    if (!colorOk) {
      throw new Error('Weinfarben-Filter trifft nicht korrekt.');
    }

    const otherRows = await queryHistory(otherClient, {});
    const isolationOk = otherRows.length === 0;
    record(steps, 'Fremder User sieht keine Scans', isolationOk);

    if (!isolationOk) {
      throw new Error('User-Isolation ist nicht korrekt.');
    }

    await cleanup(adminClient, userIds, storagePaths, wineIds);
    userIds.length = 0;
    storagePaths.length = 0;
    wineIds.length = 0;
    record(steps, 'Cleanup erfolgreich', true);

    console.log('PASS');
  } catch (error) {
    if (adminClient) {
      try {
        await cleanup(adminClient, userIds, storagePaths, wineIds);
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

void runHistoryTest();
