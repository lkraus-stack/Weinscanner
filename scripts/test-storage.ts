import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
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
  STORAGE_TEST_EMAIL: string;
  STORAGE_TEST_PASSWORD: string;
};

const ENV_PATH = resolve(process.cwd(), '.env.test');
const BUCKET_NAME = 'wine-labels';
const MAX_IMAGE_BYTES = 500 * 1024;
const DEFAULT_TEST_EMAIL = 'storage-test@wine-scanner.dev';
const DEFAULT_TEST_PASSWORD = 'ChangeMeStorageTest123!';
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
    STORAGE_TEST_EMAIL: DEFAULT_TEST_EMAIL,
    STORAGE_TEST_PASSWORD: DEFAULT_TEST_PASSWORD,
    ...parseEnvFile(rawEnv),
  };
  const requiredKeys: Array<keyof TestEnv> = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STORAGE_TEST_EMAIL',
    'STORAGE_TEST_PASSWORD',
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

function getFixtureArrayBuffer(): ArrayBuffer {
  const fixtureBuffer = Buffer.from(INLINE_TEST_JPEG_BASE64, 'base64');

  return fixtureBuffer.buffer.slice(
    fixtureBuffer.byteOffset,
    fixtureBuffer.byteOffset + fixtureBuffer.byteLength
  ) as ArrayBuffer;
}

async function cleanup(
  adminClient: SupabaseClient,
  userId: string,
  storagePath: string | null
) {
  if (storagePath) {
    await adminClient.storage.from(BUCKET_NAME).remove([storagePath]);
  }

  await adminClient.auth.admin.deleteUser(userId);
}

async function runStorageSmokeTest() {
  const steps: Step[] = [];
  let adminClient: SupabaseClient | null = null;
  let testUser: User | null = null;
  let storagePath: string | null = null;

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
      env.STORAGE_TEST_EMAIL,
      env.STORAGE_TEST_PASSWORD
    );
    record(steps, 'Test-User erstellt oder gefunden', Boolean(testUser?.id));

    const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { error: signInError } = await anonClient.auth.signInWithPassword({
      email: env.STORAGE_TEST_EMAIL,
      password: env.STORAGE_TEST_PASSWORD,
    });

    if (signInError) {
      throw signInError;
    }

    record(steps, 'Anon-Login erfolgreich', true);

    const fixtureBuffer = getFixtureArrayBuffer();
    record(steps, 'Test-JPEG geladen', fixtureBuffer.byteLength > 0);

    const uploadResult = await uploadBuffer(
      testUser.id,
      fixtureBuffer,
      `storage-smoke-${Date.now()}.jpg`,
      anonClient
    );
    storagePath = uploadResult.storagePath;
    record(steps, 'uploadBuffer erfolgreich', true);

    const signedUrlResponse = await fetch(uploadResult.signedUrl, {
      method: 'HEAD',
    });
    const fileName = storagePath.split('/').at(-1);
    const { data: listedFiles, error: listError } = await adminClient.storage
      .from(BUCKET_NAME)
      .list(testUser.id);

    if (listError) {
      throw listError;
    }

    const listedFile = listedFiles.find((file) => file.name === fileName);
    const fileSize = Number(listedFile?.metadata?.size ?? 0);
    const validationPassed =
      storagePath.startsWith(`${testUser.id}/`) &&
      storagePath.endsWith('.jpg') &&
      signedUrlResponse.status === 200 &&
      Boolean(listedFile) &&
      fileSize > 0 &&
      fileSize < MAX_IMAGE_BYTES;

    record(
      steps,
      'Pfad, Signed URL, Bucket-Datei und Größe validiert',
      validationPassed
    );

    if (!validationPassed) {
      throw new Error('Storage-Validierung fehlgeschlagen.');
    }

    await cleanup(adminClient, testUser.id, storagePath);
    storagePath = null;
    record(steps, 'Cleanup erfolgreich', true);

    console.log('PASS');
  } catch (error) {
    if (adminClient && testUser?.id) {
      try {
        await cleanup(adminClient, testUser.id, storagePath);
      } catch (cleanupError) {
        console.error('Cleanup-Fehler:', cleanupError);
      }
    }

    printMissingSteps(steps);
    console.error(error);
    console.log('FAIL');
    process.exitCode = 1;
  }
}

function printMissingSteps(steps: Step[]) {
  const printedLabels = new Set(steps.map((step) => step.label));
  const expectedLabels = [
    '.env.test geladen',
    'Admin-Client erstellt',
    'Test-User erstellt oder gefunden',
    'Anon-Login erfolgreich',
    'Test-JPEG geladen',
    'uploadBuffer erfolgreich',
    'Pfad, Signed URL, Bucket-Datei und Größe validiert',
    'Cleanup erfolgreich',
  ];

  expectedLabels
    .filter((label) => !printedLabels.has(label))
    .forEach((label) => record(steps, label, false));
}

void runStorageSmokeTest();
