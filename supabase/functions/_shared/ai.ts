import OpenAI from 'npm:openai@4.62.1';

type VisionCompletionOptions = {
  imageUrl: string;
  maxTokens: number;
  signal: AbortSignal;
  system: string;
  userText: string;
};

const DEFAULT_VANTERO_MODEL = 'chat-model-gemini-2.5-flash';

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

export const VANTERO_MODEL =
  readEnv('VANTERO_MODEL_ID') ?? DEFAULT_VANTERO_MODEL;

export const vanteroClient = new OpenAI({
  apiKey: readEnv('VANTERO_API_KEY') ?? 'missing-vantero-api-key',
  baseURL: readEnv('VANTERO_API_BASE_URL') ?? 'https://api.vantero.chat/v1',
});

export function assertVanteroConfigured() {
  requiredEnv('VANTERO_API_KEY');
  requiredEnv('VANTERO_API_BASE_URL');
}

export async function createVisionChatCompletion({
  imageUrl,
  maxTokens,
  signal,
  system,
  userText,
}: VisionCompletionOptions): Promise<string> {
  assertVanteroConfigured();

  const response = await vanteroClient.chat.completions.create(
    {
      max_tokens: maxTokens,
      messages: [
        {
          content: system,
          role: 'system',
        },
        {
          content: [
            {
              text: userText,
              type: 'text',
            },
            {
              image_url: {
                url: imageUrl,
              },
              type: 'image_url',
            },
          ],
          role: 'user',
        },
      ],
      model: VANTERO_MODEL,
      response_format: {
        type: 'json_object',
      },
    },
    { signal }
  );
  const responseText = response.choices[0]?.message?.content;

  if (!responseText) {
    throw new Error('Vantero-Response enthält keinen Text.');
  }

  return responseText;
}
