import OpenAI from 'npm:openai@4.62.1';

type VisionCompletionOptions = {
  imageUrl: string;
  maxTokens: number;
  model?: string;
  purpose?: VanteroModelPurpose;
  secondaryImageUrl?: string;
  signal: AbortSignal;
  system: string;
  userText: string;
};

type TextCompletionOptions = {
  maxTokens: number;
  model?: string;
  purpose?: VanteroModelPurpose;
  signal: AbortSignal;
  system: string;
  userText: string;
};

export type VanteroModelPurpose =
  | 'default'
  | 'label'
  | 'validation'
  | 'adjudicator'
  | 'source';

const DEFAULT_LABEL_MODEL = 'gemini-flash';
const DEFAULT_VALIDATION_MODEL = 'gpt-oss';
const DEFAULT_ADJUDICATOR_MODEL = 'qwen3-vl-de';
const DEFAULT_SOURCE_MODEL = 'mistral-large';
const DEFAULT_BASE64_VISION_MODEL = 'qwen3-vl-de';

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
  readEnv('VANTERO_MODEL_ID') ?? DEFAULT_LABEL_MODEL;

export function resolveVanteroModel(
  purpose: VanteroModelPurpose = 'default',
  explicitModel?: string
) {
  if (explicitModel) {
    return explicitModel;
  }

  if (purpose === 'label') {
    return readEnv('VANTERO_LABEL_MODEL_ID') ?? DEFAULT_LABEL_MODEL;
  }

  if (purpose === 'validation') {
    return readEnv('VANTERO_VALIDATION_MODEL_ID') ?? DEFAULT_VALIDATION_MODEL;
  }

  if (purpose === 'adjudicator') {
    return (
      readEnv('VANTERO_ADJUDICATOR_MODEL_ID') ??
      DEFAULT_ADJUDICATOR_MODEL
    );
  }

  if (purpose === 'source') {
    return readEnv('VANTERO_SOURCE_MODEL_ID') ?? DEFAULT_SOURCE_MODEL;
  }

  return VANTERO_MODEL;
}

export const vanteroClient = new OpenAI({
  apiKey: readEnv('VANTERO_API_KEY') ?? 'missing-vantero-api-key',
  baseURL: readEnv('VANTERO_API_BASE_URL') ?? 'https://api.vantero.chat/v1',
});

const MAX_INLINE_IMAGE_BYTES = 8 * 1024 * 1024;
const VANTERO_ALLOWED_IMAGE_HOSTS = ['stackit.de'];

export function assertVanteroConfigured() {
  requiredEnv('VANTERO_API_KEY');
  requiredEnv('VANTERO_API_BASE_URL');
}

function shouldInlineVisionImage(imageUrl: string) {
  if (imageUrl.startsWith('data:image/')) {
    return false;
  }

  try {
    const host = new URL(imageUrl).hostname.toLowerCase();

    return !VANTERO_ALLOWED_IMAGE_HOSTS.some(
      (allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`)
    );
  } catch {
    return false;
  }
}

function isInlineImageUrl(imageUrl: string | undefined) {
  return Boolean(imageUrl?.startsWith('data:image/'));
}

function getBase64VisionModel() {
  return readEnv('VANTERO_BASE64_VISION_MODEL_ID') ?? DEFAULT_BASE64_VISION_MODEL;
}

function isBase64UnsupportedError(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? '');

  return /base64 image input/i.test(message);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const chunks: string[] = [];

  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(index, index + chunkSize))
    );
  }

  return btoa(chunks.join(''));
}

async function inlineVisionImageUrl(imageUrl: string, signal: AbortSignal) {
  if (!shouldInlineVisionImage(imageUrl)) {
    return imageUrl;
  }

  const response = await fetch(imageUrl, { signal });

  if (!response.ok) {
    throw new Error('Bild konnte für die KI-Analyse nicht geladen werden.');
  }

  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  const buffer = await response.arrayBuffer();

  if (buffer.byteLength > MAX_INLINE_IMAGE_BYTES) {
    throw new Error('Bild ist zu groß für die KI-Analyse.');
  }

  return `data:${contentType};base64,${arrayBufferToBase64(buffer)}`;
}

export async function createVisionChatCompletion({
  imageUrl,
  maxTokens,
  model,
  purpose = 'default',
  secondaryImageUrl,
  signal,
  system,
  userText,
}: VisionCompletionOptions): Promise<string> {
  assertVanteroConfigured();

  const [preparedImageUrl, preparedSecondaryImageUrl] = await Promise.all([
    inlineVisionImageUrl(imageUrl, signal),
    secondaryImageUrl
      ? inlineVisionImageUrl(secondaryImageUrl, signal)
      : Promise.resolve(undefined),
  ]);
  const hasInlineImage =
    isInlineImageUrl(preparedImageUrl) ||
    isInlineImageUrl(preparedSecondaryImageUrl);
  const resolvedModel = resolveVanteroModel(purpose, model);

  async function requestVisionCompletion(modelId: string) {
    return vanteroClient.chat.completions.create(
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
                  url: preparedImageUrl,
                },
                type: 'image_url',
              },
              ...(preparedSecondaryImageUrl
                ? [
                    {
                      text: 'Zweite Ansicht: Rücketikett, Kapsel oder weiteres Foto derselben Flasche.',
                      type: 'text' as const,
                    },
                    {
                      image_url: {
                        url: preparedSecondaryImageUrl,
                      },
                      type: 'image_url' as const,
                    },
                  ]
                : []),
            ],
            role: 'user',
          },
        ],
        model: modelId,
        response_format: {
          type: 'json_object',
        },
      },
      { signal }
    );
  }

  let response: Awaited<ReturnType<typeof requestVisionCompletion>>;

  try {
    response = await requestVisionCompletion(resolvedModel);
  } catch (error) {
    const fallbackModel = getBase64VisionModel();

    if (
      !hasInlineImage ||
      !isBase64UnsupportedError(error) ||
      fallbackModel === resolvedModel
    ) {
      throw error;
    }

    response = await requestVisionCompletion(fallbackModel);
  }

  const responseText = response.choices[0]?.message?.content;

  if (!responseText) {
    throw new Error('Vantero-Response enthält keinen Text.');
  }

  return responseText;
}

export async function createTextChatCompletion({
  maxTokens,
  model,
  purpose = 'default',
  signal,
  system,
  userText,
}: TextCompletionOptions): Promise<string> {
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
          content: userText,
          role: 'user',
        },
      ],
      model: resolveVanteroModel(purpose, model),
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
