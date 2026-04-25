import OpenAI from 'npm:openai@4.62.1';

function readEnv(key: string): string | undefined {
  const value = Deno.env.get(key);

  return value || undefined;
}

function requiredEnv(key: string): string {
  const value = readEnv(key);

  if (!value) {
    throw new Error(`Missing env var: ${key}`);
  }

  return value;
}

export const VANTERO_MODEL = readEnv('VANTERO_MODEL_ID') ?? '';

export const vanteroClient = new OpenAI({
  apiKey: readEnv('VANTERO_API_KEY') ?? 'missing-vantero-api-key',
  baseURL: readEnv('VANTERO_API_BASE_URL') ?? 'https://api.vantero.chat/v1',
});

export function assertVanteroConfigured() {
  requiredEnv('VANTERO_API_KEY');
  requiredEnv('VANTERO_API_BASE_URL');
  requiredEnv('VANTERO_MODEL_ID');
}
