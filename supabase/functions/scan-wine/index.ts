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
  type MinimalWineExtraction,
  type WineExtraction,
  validateExtractWineRequest,
} from '../_shared/wine-schema.ts';

const LOW_CONFIDENCE_THRESHOLD = 0.4;
const PRODUCT_CONFIDENCE_THRESHOLD = 0.55;
const PIPELINE_TIMEOUT_MS = 90_000;

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

function buildLabelEvidenceText(minimal: MinimalWineExtraction) {
  return JSON.stringify(
    {
      grape_variety: minimal.grape_variety,
      needs_more_info_reason: minimal.needs_more_info_reason,
      photo_quality: minimal.photo_quality,
      producer: minimal.producer,
      visible_text_lines: minimal.visible_text_lines,
      wine_name: minimal.wine_name,
      vintage_year: minimal.vintage_year,
    },
    null,
    2
  );
}

function needsMoreLabelInfo(minimal: MinimalWineExtraction) {
  if (minimal.photo_quality === 'poor') {
    return 'Das Foto ist zu unscharf, zu dunkel oder das Etikett ist zu klein.';
  }

  if (!minimal.producer || minimal.confidence.producer < PRODUCT_CONFIDENCE_THRESHOLD) {
    return 'Das Weingut ist nicht sicher lesbar.';
  }

  if (!minimal.wine_name || minimal.confidence.wine_name < PRODUCT_CONFIDENCE_THRESHOLD) {
    return 'Der konkrete Weinname ist nicht sicher lesbar.';
  }

  return null;
}

function preferLabelEvidence(
  extraction: WineExtraction,
  minimal: MinimalWineExtraction
): WineExtraction {
  return {
    ...extraction,
    confidence: {
      ...extraction.confidence,
      producer: Math.max(extraction.confidence.producer, minimal.confidence.producer),
      vintage_year:
        minimal.vintage_year === null
          ? extraction.confidence.vintage_year
          : Math.max(
              extraction.confidence.vintage_year,
              minimal.confidence.vintage_year
            ),
      wine_name: Math.max(
        extraction.confidence.wine_name,
        minimal.confidence.wine_name
      ),
    },
    grape_variety: minimal.grape_variety ?? extraction.grape_variety,
    producer: minimal.producer || extraction.producer,
    vintage_year: minimal.vintage_year ?? extraction.vintage_year,
    wine_name: minimal.wine_name || extraction.wine_name,
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

    const { imageUrl, secondaryImageUrl } = validateExtractWineRequest(
      await req.json()
    );
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), PIPELINE_TIMEOUT_MS);

    try {
      const minimal = await extractWineMinimal(
        imageUrl,
        abortController.signal,
        secondaryImageUrl
      );

      if (minimal.confidence.overall < LOW_CONFIDENCE_THRESHOLD) {
        return jsonResponse({
          minimal,
          source: 'low_confidence',
        });
      }

      const infoReason = needsMoreLabelInfo(minimal);

      if (infoReason) {
        return jsonResponse({
          minimal,
          reason: infoReason,
          source: 'needs_more_info',
        });
      }

      const supabase = createServiceClient();
      const searchResult = await searchWineInDb(supabase, {
        grapeVariety: minimal.grape_variety,
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
          ocrText: buildLabelEvidenceText(minimal),
          secondaryImageUrl,
        },
        abortController.signal
      );
      const labelAlignedExtraction = preferLabelEvidence(extraction, minimal);
      const secondSearchResult = await searchWineInDb(supabase, {
        grapeVariety: labelAlignedExtraction.grape_variety,
        producer: labelAlignedExtraction.producer,
        vintageYear: labelAlignedExtraction.vintage_year,
        wineName: labelAlignedExtraction.wine_name,
      });

      if (secondSearchResult.found) {
        return jsonResponse({
          matchedVintage: secondSearchResult.matchedVintage,
          minimal,
          source: 'cache',
          vintages: secondSearchResult.vintages,
          wine: secondSearchResult.wine,
        });
      }

      const persisted = await persistFreshWine(supabase, labelAlignedExtraction);

      return jsonResponse({
        extraction: labelAlignedExtraction,
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
