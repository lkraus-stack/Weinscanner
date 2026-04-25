import { createClient } from 'jsr:@supabase/supabase-js@2';

export const CORS_HEADERS = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

export const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: JSON_HEADERS,
    status,
  });
}

export function getBearerToken(req: Request) {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length);
}

export async function requireUser(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    throw jsonResponse({ error: 'Nicht eingeloggt.' }, 401);
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
    throw jsonResponse({ error: 'Nicht eingeloggt.' }, 401);
  }

  return user;
}

export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export function createUserClient(token: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

export function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: CORS_HEADERS,
      status: 204,
    });
  }

  return null;
}

export function requirePost(req: Request) {
  if (req.method !== 'POST') {
    throw jsonResponse({ error: 'Methode nicht erlaubt.' }, 405);
  }
}

export function errorResponse(error: unknown) {
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
          : 'Der Vorgang konnte nicht abgeschlossen werden.';

  console.error('edge function failed:', message);

  return jsonResponse({ error: message }, 500);
}
