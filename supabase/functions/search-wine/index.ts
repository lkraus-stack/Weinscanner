import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  createServiceClient,
  errorResponse,
  handleCors,
  jsonResponse,
  requirePost,
  requireUser,
} from '../_shared/http.ts';
import { searchWineInDb } from '../_shared/search.ts';

type SearchWineRequest = {
  grapeVariety?: string | null;
  producer: string;
  vintageYear?: number | null;
  wineName: string;
};

function validateSearchWineRequest(value: unknown): SearchWineRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Ungültiger Request.');
  }

  const record = value as Record<string, unknown>;

  if (typeof record.producer !== 'string' || !record.producer.trim()) {
    throw new Error('Ungültiger Request: producer fehlt.');
  }

  if (typeof record.wineName !== 'string' || !record.wineName.trim()) {
    throw new Error('Ungültiger Request: wineName fehlt.');
  }

  return {
    grapeVariety:
      typeof record.grapeVariety === 'string' && record.grapeVariety.trim()
        ? record.grapeVariety.trim()
        : null,
    producer: record.producer.trim(),
    vintageYear:
      typeof record.vintageYear === 'number'
        ? Math.round(record.vintageYear)
        : null,
    wineName: record.wineName.trim(),
  };
}

serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  try {
    requirePost(req);
    await requireUser(req);

    const payload = validateSearchWineRequest(await req.json());
    const result = await searchWineInDb(createServiceClient(), payload);

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});
