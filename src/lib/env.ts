import Constants from 'expo-constants';

type ExpoExtra = {
  supabaseUrl?: unknown;
  supabaseAnonKey?: unknown;
  privacyUrl?: unknown;
  imprintUrl?: unknown;
  googleMapsIosKey?: unknown;
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
  PRIVACY_URL: optional(extra?.privacyUrl),
  IMPRINT_URL: optional(extra?.imprintUrl),
  GOOGLE_MAPS_IOS_KEY: optional(extra?.googleMapsIosKey),
} as const;

function optional(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
