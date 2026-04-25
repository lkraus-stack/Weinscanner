import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  assertVanteroConfigured,
  vanteroClient,
  VANTERO_MODEL,
} from '../_shared/ai.ts';
import { SYSTEM_PROMPT } from './prompt.ts';
import {
  validateExtractWineRequest,
  validateWineExtraction,
  type ExtractWineRequest,
} from './types.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
};

const VANTERO_TIMEOUT_MS = 30_000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: JSON_HEADERS,
    status,
  });
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length);
}

async function requireUser(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    throw new Response(JSON.stringify({ error: 'Nicht eingeloggt.' }), {
      headers: JSON_HEADERS,
      status: 401,
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Response(JSON.stringify({ error: 'Nicht eingeloggt.' }), {
      headers: JSON_HEADERS,
      status: 401,
    });
  }

  return user;
}

function extractJson(text: string) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Kein JSON in Vantero-Response.');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Vantero-JSON konnte nicht gelesen werden.');
  }
}

function buildUserText({ ocrText }: ExtractWineRequest) {
  if (ocrText) {
    return `Erkannter Text auf dem Etikett:\n${ocrText}\n\nAnalysiere zusätzlich das Bild.`;
  }

  return 'Analysiere das Wein-Etikett auf dem Bild.';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: CORS_HEADERS,
      status: 204,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    await requireUser(req);
    assertVanteroConfigured();

    const payload = validateExtractWineRequest(await req.json());
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), VANTERO_TIMEOUT_MS);

    try {
      const response = await vanteroClient.chat.completions.create(
        {
          max_tokens: 4000,
          messages: [
            {
              content: SYSTEM_PROMPT,
              role: 'system',
            },
            {
              content: [
                {
                  text: buildUserText(payload),
                  type: 'text',
                },
                {
                  image_url: {
                    url: payload.imageUrl,
                  },
                  type: 'image_url',
                },
              ],
              role: 'user',
            },
          ],
          model: VANTERO_MODEL,
        },
        { signal: abortController.signal }
      );
      const responseText = response.choices[0]?.message?.content;

      if (!responseText) {
        throw new Error('Vantero-Response enthält keinen Text.');
      }

      const extraction = validateWineExtraction(extractJson(responseText));

      return jsonResponse(extraction);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Die Analyse hat zu lange gedauert. Bitte versuche es erneut.'
        : error instanceof Error && error.message.startsWith('Missing env var:')
          ? 'Vantero ist noch nicht vollständig konfiguriert.'
          : error instanceof Error
            ? error.message
            : 'Das Etikett konnte nicht analysiert werden.';

    console.error('extract-wine failed:', message);

    return jsonResponse({ error: message }, 500);
  }
});
