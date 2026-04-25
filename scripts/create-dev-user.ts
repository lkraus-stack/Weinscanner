import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type DevEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  DEV_LOGIN_EMAIL: string;
  DEV_LOGIN_PASSWORD: string;
};

const ENV_PATH = resolve(process.cwd(), '.env.test');
const DEFAULT_DEV_EMAIL = 'dev@wine-scanner.dev';
const DEFAULT_DEV_PASSWORD = 'WineScanner2026!';

function parseEnvFile(contents: string): Partial<DevEnv> {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce<Partial<DevEnv>>((env, line) => {
      const separatorIndex = line.indexOf('=');

      if (separatorIndex === -1) {
        return env;
      }

      const key = line.slice(0, separatorIndex).trim() as keyof DevEnv;
      const value = line.slice(separatorIndex + 1).trim();

      env[key] = value;

      return env;
    }, {});
}

function loadEnv(): DevEnv {
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
    DEV_LOGIN_EMAIL: DEFAULT_DEV_EMAIL,
    DEV_LOGIN_PASSWORD: DEFAULT_DEV_PASSWORD,
    ...parseEnvFile(rawEnv),
  };
  const requiredKeys: Array<keyof DevEnv> = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DEV_LOGIN_EMAIL',
    'DEV_LOGIN_PASSWORD',
  ];
  const missingKeys = requiredKeys.filter((key) => !env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`.env.test ist unvollständig: ${missingKeys.join(', ')}`);
  }

  return env as DevEnv;
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

async function createOrUpdateDevUser() {
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
  const existingUser = await findUserByEmail(adminClient, env.DEV_LOGIN_EMAIL);

  if (existingUser) {
    const { error } = await adminClient.auth.admin.updateUserById(
      existingUser.id,
      {
        email_confirm: true,
        password: env.DEV_LOGIN_PASSWORD,
      }
    );

    if (error) {
      throw error;
    }

    console.log('Dev-User aktualisiert:');
    console.log(`E-Mail: ${env.DEV_LOGIN_EMAIL}`);
    console.log(`Passwort: ${env.DEV_LOGIN_PASSWORD}`);
    return;
  }

  const { error } = await adminClient.auth.admin.createUser({
    email: env.DEV_LOGIN_EMAIL,
    email_confirm: true,
    password: env.DEV_LOGIN_PASSWORD,
  });

  if (error) {
    throw error;
  }

  console.log('Dev-User erstellt:');
  console.log(`E-Mail: ${env.DEV_LOGIN_EMAIL}`);
  console.log(`Passwort: ${env.DEV_LOGIN_PASSWORD}`);
}

createOrUpdateDevUser().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
