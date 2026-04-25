import Constants from 'expo-constants';

type ExpoExtra = {
  supabaseUrl?: unknown;
  supabaseAnonKey?: unknown;
};

const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;

function required(key: string, value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing env var: ${key}`);
  }

  return value;
}

export const env = {
  SUPABASE_URL: required('SUPABASE_URL', extra?.supabaseUrl),
  SUPABASE_ANON_KEY: required(
    'SUPABASE_ANON_KEY',
    extra?.supabaseAnonKey
  ),
} as const;
