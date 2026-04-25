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
import {
  extractWineFull,
  extractWineMinimal,
} from '../_shared/wine-analysis.ts';
import {
  type WineExtraction,
  validateExtractWineRequest,
} from '../_shared/wine-schema.ts';

const LOW_CONFIDENCE_THRESHOLD = 0.4;
const PIPELINE_TIMEOUT_MS = 45_000;

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

function buildWineInsert(extraction: WineExtraction) {
  return {
    appellation: extraction.appellation,
    country: extraction.country,
    grape_variety: extraction.grape_variety,
    producer: extraction.producer || 'Unbekanntes Weingut',
    region: extraction.region,
    taste_dryness: extraction.taste_dryness,
    wine_color: extraction.wine_color,
    wine_name: extraction.wine_name || 'Unbekannter Wein',
  };
}

function buildVintageInsert(wineId: string, extraction: WineExtraction) {
  if (extraction.vintage_year === null) {
    return null;
  }

  return {
    ai_confidence: extraction.confidence.overall,
    alcohol_percent: extraction.alcohol_percent,
    aromas: extraction.aromas,
    data_sources: extraction.data_sources,
    description_long: extraction.description_long,
    description_short: extraction.description_short,
    drinking_window_end: extraction.drinking_window_end,
    drinking_window_start: extraction.drinking_window_start,
    food_pairing: extraction.food_pairing,
    price_max_eur: extraction.price_max_eur,
    price_min_eur: extraction.price_min_eur,
    serving_temperature: extraction.serving_temperature,
    vinification: extraction.vinification,
    vintage_year: extraction.vintage_year,
    wine_id: wineId,
  };
}

async function persistFreshWine(
  supabase: SupabaseServiceClient,
  extraction: WineExtraction
) {
  const { data: wine, error: wineError } = await supabase
    .from('wines')
    .insert(buildWineInsert(extraction))
    .select('*')
    .single();

  if (wineError || !wine) {
    throw wineError ?? new Error('Wein konnte nicht gespeichert werden.');
  }

  const vintageInsert = buildVintageInsert(wine.id, extraction);

  if (!vintageInsert) {
    return {
      matchedVintage: null,
      vintage: null,
      vintages: [],
      wine,
    };
  }

  const { data: vintage, error: vintageError } = await supabase
    .from('vintages')
    .upsert(vintageInsert, {
      onConflict: 'wine_id,vintage_year',
    })
    .select('*')
    .single();

  if (vintageError || !vintage) {
    throw vintageError ?? new Error('Jahrgang konnte nicht gespeichert werden.');
  }

  return {
    matchedVintage: vintage,
    vintage,
    vintages: [vintage],
    wine,
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

    const { imageUrl } = validateExtractWineRequest(await req.json());
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), PIPELINE_TIMEOUT_MS);

    try {
      const minimal = await extractWineMinimal(
        imageUrl,
        abortController.signal
      );

      if (minimal.confidence.overall < LOW_CONFIDENCE_THRESHOLD) {
        return jsonResponse({
          minimal,
          source: 'low_confidence',
        });
      }

      const supabase = createServiceClient();
      const searchResult = await searchWineInDb(supabase, {
        producer: minimal.producer,
        vintageYear: minimal.vintage_year,
        wineName: minimal.wine_name,
      });

      if (searchResult.found) {
        return jsonResponse({
          matchedVintage: searchResult.matchedVintage,
          minimal,
          source: 'cache',
          vintages: searchResult.vintages,
          wine: searchResult.wine,
        });
      }

      const extraction = await extractWineFull(
        {
          imageUrl,
        },
        abortController.signal
      );
      const persisted = await persistFreshWine(supabase, extraction);

      return jsonResponse({
        extraction,
        matchedVintage: persisted.matchedVintage,
        minimal,
        source: 'fresh',
        vintage: persisted.vintage,
        vintages: persisted.vintages,
        wine: persisted.wine,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return errorResponse(error);
  }
});
