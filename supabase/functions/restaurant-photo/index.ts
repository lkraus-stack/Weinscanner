import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  errorResponse,
  handleCors,
} from '../_shared/http.ts';

function isValidPhotoName(value: string | null) {
  return Boolean(
    value &&
      value.startsWith('places/') &&
      value.includes('/photos/') &&
      value.length < 600
  );
}

serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  try {
    const url = new URL(req.url);
    const photoName = url.searchParams.get('name');
    const googlePlacesKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

    if (!googlePlacesKey || !isValidPhotoName(photoName)) {
      return new Response(null, { status: 404 });
    }

    const metadataResponse = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${googlePlacesKey}`
    );

    if (!metadataResponse.ok) {
      return new Response(null, { status: 404 });
    }

    const metadata = await metadataResponse.json();
    const photoUri =
      typeof metadata.photoUri === 'string' ? metadata.photoUri : null;

    if (!photoUri) {
      return new Response(null, { status: 404 });
    }

    const imageResponse = await fetch(photoUri);

    if (!imageResponse.ok || !imageResponse.body) {
      return new Response(null, { status: 404 });
    }

    return new Response(imageResponse.body, {
      headers: {
        'Cache-Control': 'public, max-age=86400',
        'Content-Type':
          imageResponse.headers.get('Content-Type') ?? 'image/jpeg',
      },
      status: 200,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
