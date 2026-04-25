import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { uploadBuffer } from '../src/lib/storage';

type TestEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  EXTRACT_WINE_TEST_EMAIL: string;
  EXTRACT_WINE_TEST_PASSWORD: string;
  EXTRACT_WINE_TEST_IMAGE_URL?: string;
  EXTRACT_WINE_TEST_LOCAL_IMAGE_PATH?: string;
  EXTRACT_WINE_TEST_OCR_TEXT?: string;
};

const ENV_PATH = resolve(process.cwd(), '.env.test');
const BUCKET_NAME = 'wine-labels';
const DEFAULT_TEST_EMAIL = 'extract-test@wine-scanner.dev';
const DEFAULT_TEST_PASSWORD = 'ChangeMeExtractTest123!';

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
    EXTRACT_WINE_TEST_EMAIL: DEFAULT_TEST_EMAIL,
    EXTRACT_WINE_TEST_PASSWORD: DEFAULT_TEST_PASSWORD,
    ...parseEnvFile(rawEnv),
  };
  const requiredKeys: Array<keyof TestEnv> = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'EXTRACT_WINE_TEST_EMAIL',
    'EXTRACT_WINE_TEST_PASSWORD',
  ];
  const missingKeys = requiredKeys.filter((key) => !env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`.env.test ist unvollständig: ${missingKeys.join(', ')}`);
  }

  if (!env.EXTRACT_WINE_TEST_IMAGE_URL && !env.EXTRACT_WINE_TEST_LOCAL_IMAGE_PATH) {
    throw new Error(
      '.env.test braucht EXTRACT_WINE_TEST_IMAGE_URL oder EXTRACT_WINE_TEST_LOCAL_IMAGE_PATH.'
    );
  }

  if (
    env.EXTRACT_WINE_TEST_IMAGE_URL?.includes('example.com') &&
    !env.EXTRACT_WINE_TEST_LOCAL_IMAGE_PATH
  ) {
    throw new Error(
      'EXTRACT_WINE_TEST_IMAGE_URL muss auf ein echtes Wein-Etikett zeigen.'
    );
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

function printCheck(label: string, ok: boolean) {
  console.log(`${ok ? 'JA' : 'NEIN'} ${label}`);
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

async function prepareTestImageUrl(
  env: TestEnv,
  userId: string,
  anonClient: SupabaseClient
) {
  if (!env.EXTRACT_WINE_TEST_LOCAL_IMAGE_PATH) {
    return {
      imageUrl: env.EXTRACT_WINE_TEST_IMAGE_URL ?? '',
      storagePath: null,
    };
  }

  const localImagePath = resolve(
    process.cwd(),
    env.EXTRACT_WINE_TEST_LOCAL_IMAGE_PATH
  );
  const imageBuffer = readFileSync(localImagePath);
  const uploadResult = await uploadBuffer(
    userId,
    toArrayBuffer(imageBuffer),
    `extract-smoke-${Date.now()}.jpg`,
    anonClient
  );

  return {
    imageUrl: uploadResult.signedUrl,
    storagePath: uploadResult.storagePath,
  };
}

async function invokeExtractWine(
  env: TestEnv,
  accessToken: string,
  imageUrl: string
) {
  const response = await fetch(`${env.SUPABASE_URL}/functions/v1/extract-wine`, {
    body: JSON.stringify({
      imageUrl,
      ocrText: env.EXTRACT_WINE_TEST_OCR_TEXT,
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
      `Edge Function returned ${response.status} ${response.statusText}: ${responseText}`
    );
  }

  return JSON.parse(responseText);
}

async function runExtractWineTest() {
  let adminClient: SupabaseClient | null = null;
  let user: User | null = null;
  let uploadedStoragePath: string | null = null;
  let passed = false;

  try {
    const env = loadEnv();
    printCheck('.env.test geladen', true);

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
    printCheck('Admin-Client erstellt', true);

    user = await createOrUpdateTestUser(
      adminClient,
      env.EXTRACT_WINE_TEST_EMAIL,
      env.EXTRACT_WINE_TEST_PASSWORD
    );
    printCheck('Test-User erstellt oder gefunden', true);

    const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data: signInData, error: signInError } =
      await anonClient.auth.signInWithPassword({
        email: env.EXTRACT_WINE_TEST_EMAIL,
        password: env.EXTRACT_WINE_TEST_PASSWORD,
      });

    if (signInError || !signInData.session) {
      throw signInError ?? new Error('Anon-Login hat keine Session geliefert.');
    }

    printCheck('Anon-Login erfolgreich', true);
    const preparedImage = await prepareTestImageUrl(env, user.id, anonClient);
    uploadedStoragePath = preparedImage.storagePath;
    printCheck(
      preparedImage.storagePath
        ? 'Lokales Test-Etikett hochgeladen'
        : 'Test-Etikett-URL geladen',
      Boolean(preparedImage.imageUrl)
    );

    const data = await invokeExtractWine(
      env,
      signInData.session.access_token,
      preparedImage.imageUrl
    );
    printCheck('extract-wine erfolgreich', true);
    console.log(JSON.stringify(data, null, 2));
    passed = true;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.stack : error);
  } finally {
    if (adminClient && uploadedStoragePath) {
      await adminClient.storage.from(BUCKET_NAME).remove([uploadedStoragePath]);
      printCheck('Test-Etikett aus Storage gelöscht', true);
    }

    if (adminClient && user) {
      await adminClient.auth.admin.deleteUser(user.id);
      printCheck('Cleanup erfolgreich', true);
    }

    console.log(passed ? 'PASS' : 'FAIL');

    if (!passed) {
      process.exitCode = 1;
    }
  }
}

runExtractWineTest();
