import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  errorResponse,
  handleCors,
  jsonResponse,
  requirePost,
  requireUser,
} from '../_shared/http.ts';
import { extractWineMinimal } from '../_shared/wine-analysis.ts';
import { validateExtractWineRequest } from '../_shared/wine-schema.ts';

const VANTERO_TIMEOUT_MS = 15_000;

serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  try {
    requirePost(req);
    await requireUser(req);

    const { imageUrl, secondaryImageUrl } = validateExtractWineRequest(
      await req.json()
    );
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), VANTERO_TIMEOUT_MS);

    try {
      const extraction = await extractWineMinimal(
        imageUrl,
        abortController.signal,
        secondaryImageUrl
      );

      return jsonResponse(extraction);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return errorResponse(error);
  }
});
