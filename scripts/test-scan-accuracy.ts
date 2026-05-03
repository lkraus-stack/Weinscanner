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
  SCAN_ACCURACY_KURTATSCH_IMAGE_PATH?: string;
  SCAN_ACCURACY_TEST_EMAIL?: string;
  SCAN_ACCURACY_TEST_PASSWORD?: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
};

type ScanWineResult = {
  extraction?: {
    data_sources?: string[];
    grape_variety?: string | null;
    grape_varieties?: string[];
    vinification?: string | null;
    vintage_year?: number | null;
    verification?: {
      field_status?: Record<string, string>;
      safe_to_persist_enrichment?: boolean;
      source_status?: string;
      status?: string;
      verified_data_sources?: string[];
    };
  };
  minimal?: {
    grape_variety?: string | null;
    grape_varieties?: string[];
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
const KURTATSCH_AMOS_SOURCE_URL =
  'https://www.kellerei-kurtatsch.it/en/wines/amos-5/';

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

function assertKurtatschIsNotOverconfident(result: ScanWineResult) {
  if (result.source === 'needs_more_info' || result.source === 'low_confidence') {
    return;
  }

  const grapes = [
    result.minimal?.grape_variety ?? '',
    ...(result.minimal?.grape_varieties ?? []),
    result.wine?.grape_variety ?? '',
    result.extraction?.grape_variety ?? '',
    ...(result.extraction?.grape_varieties ?? []),
  ]
    .join(' ')
    .toLowerCase();
  const verification = result.extraction?.verification;
  const safeEnrichment = verification?.safe_to_persist_enrichment === true;
  const dataSources = [
    ...(result.extraction?.data_sources ?? []),
    ...(verification?.verified_data_sources ?? []),
  ];
  const hasIncompleteThreeGrapeClaim =
    grapes.includes('weißburgunder') &&
    grapes.includes('chardonnay') &&
    grapes.includes('sauvignon') &&
    !grapes.includes('riesling') &&
    !grapes.includes('pinot');

  if (safeEnrichment && hasIncompleteThreeGrapeClaim) {
    throw new Error(
      'Regression: Kurtatsch-Rebsorten wurden unvollständig als sicher freigegeben.'
    );
  }

  if (
    verification?.field_status?.vinification === 'verified' &&
    result.extraction?.verification?.safe_to_persist_enrichment &&
    !result.extraction?.verification?.status
  ) {
    throw new Error('Regression: Vinifikation wurde ohne Prüfstatus freigegeben.');
  }

  if (verification?.source_status !== 'found') {
    throw new Error('Regression: Kurtatsch-Quelle wurde nicht gefunden.');
  }

  if (
    !dataSources.some((source) =>
      source.startsWith(KURTATSCH_AMOS_SOURCE_URL)
    )
  ) {
    throw new Error('Regression: Kurtatsch-Herstellerquelle fehlt.');
  }

  const expectedGrapes = [
    ['pinot bianco', 'weißburgunder', 'weissburgunder'],
    ['chardonnay'],
    ['pinot grigio', 'grauburgunder'],
    ['riesling'],
    ['sauvignon'],
  ];

  for (const alternatives of expectedGrapes) {
    if (!alternatives.some((alternative) => grapes.includes(alternative))) {
      throw new Error(
        `Regression: Kurtatsch-Rebsorte fehlt: ${alternatives.join(' / ')}`
      );
    }
  }

  const vinification = result.extraction?.vinification?.toLowerCase() ?? '';

  if (
    !vinification.includes('large oak') &&
    !vinification.includes('eichen') &&
    !vinification.includes('wooden')
  ) {
    throw new Error(
      'Regression: Kurtatsch-Vinifikation enthält keine große Eichenfasslagerung.'
    );
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

    if (env.SCAN_ACCURACY_KURTATSCH_IMAGE_PATH) {
      const kurtatschImageBuffer = readFileSync(
        resolve(env.SCAN_ACCURACY_KURTATSCH_IMAGE_PATH)
      );
      const kurtatschUpload = await uploadBuffer(
        testUser.id,
        toArrayBuffer(kurtatschImageBuffer),
        `scan-accuracy-kurtatsch-${Date.now()}.jpg`,
        anonClient
      );

      try {
        const kurtatschResponse = await fetch(
          `${env.SUPABASE_URL}/functions/v1/scan-wine`,
          {
            body: JSON.stringify({
              imageUrl: kurtatschUpload.signedUrl,
            }),
            headers: {
              Authorization: `Bearer ${signInData.session.access_token}`,
              apikey: env.SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
            method: 'POST',
          }
        );
        const kurtatschResponseText = await kurtatschResponse.text();

        if (!kurtatschResponse.ok) {
          throw new Error(
            `scan-wine Kurtatsch returned ${kurtatschResponse.status} ${kurtatschResponse.statusText}: ${kurtatschResponseText}`
          );
        }

        const kurtatschResult = JSON.parse(
          kurtatschResponseText
        ) as ScanWineResult;

        assertKurtatschIsNotOverconfident(kurtatschResult);
      } finally {
        await adminClient.storage
          .from(BUCKET_NAME)
          .remove([kurtatschUpload.storagePath]);
      }
    }

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
