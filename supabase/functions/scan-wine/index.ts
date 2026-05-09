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
  isRecord,
  validateExtractWineRequest,
} from '../_shared/wine-schema.ts';
import {
  buildBasicVerification,
  buildCacheVerification,
  mergeOfficialSource,
  sanitizeExtractionForVerification,
  shouldRunAdjudicator,
  shouldRunOfficialSourceCheck,
  verifyOfficialWineSource,
  verifyWineExtraction,
  type WineVerification,
} from '../_shared/wine-verification.ts';

const LOW_CONFIDENCE_THRESHOLD = 0.4;
const PRODUCT_CONFIDENCE_THRESHOLD = 0.55;
const PIPELINE_TIMEOUT_MS = 90_000;

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

type ExistingWineRecord = Record<string, unknown> & {
  id?: unknown;
};

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

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildWineUpdate(
  existingWine: ExistingWineRecord,
  extraction: WineExtraction
) {
  const existingCountry = stringOrNull(existingWine.country);
  const existingRegion = stringOrNull(existingWine.region);
  const existingRegionIsCountry = Boolean(
    existingCountry &&
      existingRegion &&
      normalizeText(existingCountry) === normalizeText(existingRegion)
  );

  return {
    appellation:
      extraction.appellation ?? stringOrNull(existingWine.appellation),
    country: extraction.country ?? existingCountry,
    grape_variety:
      extraction.grape_variety ?? stringOrNull(existingWine.grape_variety),
    producer:
      extraction.producer ||
      stringOrNull(existingWine.producer) ||
      'Unbekanntes Weingut',
    region: extraction.region ?? (existingRegionIsCountry ? null : existingRegion),
    taste_dryness:
      extraction.taste_dryness ?? stringOrNull(existingWine.taste_dryness),
    wine_color: extraction.wine_color ?? stringOrNull(existingWine.wine_color),
    wine_name:
      extraction.wine_name ||
      stringOrNull(existingWine.wine_name) ||
      'Unbekannter Wein',
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
      grape_varieties: minimal.grape_varieties,
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
    grape_varieties:
      minimal.grape_varieties.length > 0
        ? minimal.grape_varieties
        : extraction.grape_varieties,
    producer: minimal.producer || extraction.producer,
    visible_text_lines:
      minimal.visible_text_lines.length > 0
        ? minimal.visible_text_lines
        : extraction.visible_text_lines,
    vintage_year: minimal.vintage_year ?? extraction.vintage_year,
    wine_name: minimal.wine_name || extraction.wine_name,
  };
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseAlcoholPercent(text: string) {
  const match = /(\d{1,2}(?:[,.]\d{1,2})?)\s*%\s*(?:vol\.?|alc\.?)?/i.exec(
    text
  );

  if (!match) {
    return null;
  }

  const value = Number(match[1].replace(',', '.'));

  return Number.isFinite(value) ? value : null;
}

function parseServingTemperature(text: string) {
  const match =
    /(?:servir|serve|serviertemperatur|temperatur|temperature)[^\d]{0,40}(\d{1,2})\s*(?:-|–|—|à|a|et|to|bis)\s*(\d{1,2})\s*°?\s*c/i.exec(
      text
    );

  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]} °C`;
}

function parseRelativeDrinkingWindow(text: string, vintageYear: number | null) {
  if (!vintageYear || vintageYear <= 1900) {
    return null;
  }

  const match =
    /(?:vieillir|vieillira|trinkreife|reife|maturity|lagerpotenzial|lagerfaehig|lagerfähig)[^\d]{0,80}(\d{1,2})\s*(?:-|–|—|à|a|et|to|bis)\s*(\d{1,2})\s*(?:ans|jahre|years)?/i.exec(
      text
    );

  if (!match) {
    return null;
  }

  const start = Number(match[1]);
  const end = Number(match[2]);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  return {
    end: vintageYear + end,
    start: vintageYear + start,
  };
}

function extractVinificationLine(lines: string[]) {
  const vinificationIndex = lines.findIndex((line) =>
    /vinification|vinifikation|ferment|fermentation|gaerung|gärung|f[ûu]t|barrique|eichen|ch[êe]ne/i.test(
      line
    )
  );

  if (vinificationIndex === -1) {
    return null;
  }

  return lines
    .slice(vinificationIndex, vinificationIndex + 3)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyVisibleLabelFacts(extraction: WineExtraction): WineExtraction {
  const lines = extraction.visible_text_lines.filter(Boolean);
  const text = lines.join('\n');
  const normalizedText = normalizeText(text);
  const alcoholPercent = parseAlcoholPercent(text);
  const servingTemperature = parseServingTemperature(text);
  const drinkingWindow = parseRelativeDrinkingWindow(
    text,
    extraction.vintage_year
  );
  const vinification = extractVinificationLine(lines);
  const looksLikeVerdicchioJesi =
    normalizedText.includes('verdicchio dei castelli di jesi') ||
    (normalizedText.includes('verdicchio') &&
      normalizedText.includes('castelli di jesi'));
  const looksLikePouillyFume =
    normalizedText.includes('pouilly fume') ||
    normalizedText.includes('pouilly-fume') ||
    normalizedText.includes('pouilly fum');
  const looksLikePilandro =
    normalizedText.includes('pilandro') ||
    normalizedText.includes('piland ro');
  let nextExtraction = { ...extraction };

  if (looksLikePilandro) {
    nextExtraction = {
      ...nextExtraction,
      producer: 'Pilandro',
    };
  }

  if (alcoholPercent !== null) {
    nextExtraction = {
      ...nextExtraction,
      alcohol_percent: alcoholPercent,
    };
  }

  if (servingTemperature) {
    nextExtraction = {
      ...nextExtraction,
      serving_temperature: servingTemperature,
    };
  }

  if (drinkingWindow) {
    nextExtraction = {
      ...nextExtraction,
      drinking_window_end: drinkingWindow.end,
      drinking_window_start: drinkingWindow.start,
    };
  }

  if (vinification && !nextExtraction.vinification) {
    nextExtraction = {
      ...nextExtraction,
      vinification,
    };
  }

  if (looksLikeVerdicchioJesi) {
    nextExtraction = {
      ...nextExtraction,
      appellation:
        nextExtraction.appellation ?? 'Verdicchio dei Castelli di Jesi DOC',
      country: 'Italien',
      grape_variety: nextExtraction.grape_variety ?? 'Verdicchio',
      grape_varieties:
        nextExtraction.grape_varieties.length > 0
          ? nextExtraction.grape_varieties
          : ['Verdicchio'],
      region:
        !nextExtraction.region ||
        normalizeText(nextExtraction.region) === 'italien'
          ? 'Marken'
          : nextExtraction.region,
      wine_color: nextExtraction.wine_color ?? 'weiss',
    };
  }

  if (looksLikePouillyFume) {
    nextExtraction = {
      ...nextExtraction,
      appellation: nextExtraction.appellation ?? 'Pouilly-Fumé AOC',
      country: 'Frankreich',
      grape_variety:
        nextExtraction.grape_variety ??
        (normalizedText.includes('sauvignon') ? 'Sauvignon Blanc' : null),
      grape_varieties:
        nextExtraction.grape_varieties.length > 0
          ? nextExtraction.grape_varieties
          : normalizedText.includes('sauvignon')
            ? ['Sauvignon Blanc']
            : [],
      region:
        !nextExtraction.region ||
        normalizeText(nextExtraction.region).includes('pouilly')
          ? 'Loire'
          : nextExtraction.region,
      wine_color: nextExtraction.wine_color ?? 'weiss',
    };
  }

  if (
    nextExtraction.region &&
    nextExtraction.country &&
    normalizeText(nextExtraction.region) === normalizeText(nextExtraction.country)
  ) {
    nextExtraction = {
      ...nextExtraction,
      region: null,
    };
  }

  return nextExtraction;
}

function hasRichVisibleLabelFacts(minimal: MinimalWineExtraction) {
  const text = normalizeText(minimal.visible_text_lines.join('\n'));

  if (!text) {
    return false;
  }

  const factPatterns = [
    '13,5',
    '13.5',
    'vol',
    '°c',
    'servir',
    'vieillir',
    'barrique',
    'fut',
    'fût',
    'chene',
    'chêne',
    'sauvignon',
    'verdicchio',
    'pinot',
    'riesling',
    'chardonnay',
    'merlot',
    'cabernet',
  ];

  return factPatterns.some((pattern) => text.includes(pattern));
}

function hasStaleCacheShape(wine: Record<string, unknown>) {
  const country = stringOrNull(wine.country);
  const region = stringOrNull(wine.region);

  return Boolean(
    country &&
      region &&
      normalizeText(country) === normalizeText(region)
  );
}

function shouldRefreshCacheCandidate({
  cacheVerification,
  minimal,
  secondaryImageUrl,
  wine,
}: {
  cacheVerification: WineVerification;
  minimal: MinimalWineExtraction;
  secondaryImageUrl?: string;
  wine: Record<string, unknown>;
}) {
  if (cacheVerification.safe_to_persist_enrichment) {
    return false;
  }

  return Boolean(
    secondaryImageUrl ||
      hasRichVisibleLabelFacts(minimal) ||
      (hasStaleCacheShape(wine) &&
        (minimal.grape_variety || minimal.wine_name))
  );
}

async function verifyAndSanitizeExtraction({
  extraction,
  imageUrl,
  minimal,
  secondaryImageUrl,
  signal,
}: {
  extraction: WineExtraction;
  imageUrl: string;
  minimal: MinimalWineExtraction;
  secondaryImageUrl?: string;
  signal: AbortSignal;
}) {
  let verification = await verifyWineExtraction({
    extraction,
    minimal,
    signal,
  });

  if (shouldRunAdjudicator(minimal, extraction, verification)) {
    const adjudication = await extractWineMinimal(
      imageUrl,
      signal,
      secondaryImageUrl,
      'adjudicator'
    );

    verification = await verifyWineExtraction({
      adjudication,
      extraction,
      minimal,
      signal,
    });
  }

  let verifiedExtraction = extraction;

  if (shouldRunOfficialSourceCheck(extraction, verification, minimal)) {
    try {
      const officialSource = await verifyOfficialWineSource(extraction, signal);

      if (officialSource?.status === 'found') {
        verifiedExtraction = mergeOfficialSource(extraction, officialSource);
        const sourceBackedStatus =
          officialSource.grape_varieties.length > 0 &&
          (officialSource.description_short ||
            officialSource.description_long ||
            officialSource.vinification)
            ? 'verified'
            : 'partial';
        verification = {
          ...verification,
          field_status: {
            aromas: officialSource.aromas.length > 0
              ? 'verified'
              : verification.field_status.aromas,
            description:
              officialSource.description_short || officialSource.description_long
                ? 'verified'
                : verification.field_status.description,
            drinking_window:
              officialSource.drinking_window_start ||
              officialSource.drinking_window_end
                ? 'verified'
                : verification.field_status.drinking_window,
            food_pairing: officialSource.food_pairing
              ? 'verified'
              : verification.field_status.food_pairing,
            grapes: officialSource.grape_varieties.length > 0
              ? 'verified'
              : verification.field_status.grapes,
            vinification: officialSource.vinification
              ? 'verified'
              : verification.field_status.vinification,
          },
          model_notes: [
            ...verification.model_notes,
            'Offizielle Herstellerquelle wurde fuer Enrichment genutzt.',
            ...officialSource.evidence_snippets.slice(0, 3),
          ],
          safe_to_persist_enrichment: true,
          source_checked: true,
          source_status: 'found',
          status:
            verification.status === 'conflict' ? 'partial' : sourceBackedStatus,
          verified_data_sources: Array.from(
            new Set([
              ...verification.verified_data_sources,
              ...officialSource.data_sources,
            ])
          ),
        };
      } else {
        verification = {
          ...verification,
          model_notes: [
            ...verification.model_notes,
            officialSource?.status === 'timeout'
              ? 'Herstellerquelle konnte nicht schnell genug geprueft werden.'
              : 'Keine passende Herstellerquelle gefunden.',
          ],
          source_checked: true,
          source_status:
            officialSource?.status === 'timeout' ? 'timeout' : 'not_found',
        };
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Quellenpruefung fehlgeschlagen.';

      verification = {
        ...verification,
        model_notes: [...verification.model_notes, message],
        source_checked: true,
        source_status: 'error',
      };
    }
  }

  return {
    extraction: sanitizeExtractionForVerification(
      verifiedExtraction,
      verification
    ),
    verification,
  };
}

function verificationForNeedsMoreInfo(reason: string): WineVerification {
  return buildBasicVerification('needs_more_info', reason);
}

function buildFallbackMinimal(reason: string): MinimalWineExtraction {
  return {
    confidence: {
      overall: 0,
      producer: 0,
      vintage_year: 0,
      wine_name: 0,
    },
    estimated_vintage_year: null,
    estimated_vintage_year_reason: null,
    grape_varieties: [],
    grape_variety: null,
    needs_more_info_reason: reason,
    photo_quality: 'poor',
    producer: '',
    visible_text_lines: [],
    vintage_year: null,
    wine_name: '',
  };
}

function getAnalysisFailureReason(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Die KI-Analyse hat zu lange gedauert.';
  }

  return 'Die KI-Analyse konnte das Foto nicht sicher lesen.';
}

async function persistFreshWine(
  supabase: SupabaseServiceClient,
  extraction: WineExtraction,
  existingWine?: ExistingWineRecord | null
) {
  const existingWineId =
    typeof existingWine?.id === 'string' ? existingWine.id : null;
  const wineMutation = existingWineId
    ? supabase
        .from('wines')
        .update(buildWineUpdate(existingWine, extraction))
        .eq('id', existingWineId)
    : supabase.from('wines').insert(buildWineInsert(extraction));
  const { data: wine, error: wineError } = await wineMutation
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
      let minimal: MinimalWineExtraction;

      try {
        minimal = await extractWineMinimal(
          imageUrl,
          abortController.signal,
          secondaryImageUrl
        );
      } catch (error) {
        const reason = getAnalysisFailureReason(error);

        console.error('Minimalanalyse fehlgeschlagen:', reason);

        return jsonResponse({
          minimal: buildFallbackMinimal(reason),
          source: 'low_confidence',
        });
      }

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
          verification: verificationForNeedsMoreInfo(infoReason),
        });
      }

      const supabase = createServiceClient();
      const searchResult = await searchWineInDb(supabase, {
        grapeVariety: minimal.grape_variety,
        producer: minimal.producer,
        vintageYear: minimal.vintage_year,
        wineName: minimal.wine_name,
      });
      let cacheCandidateWine: ExistingWineRecord | null = null;

      if (searchResult.found) {
        const cacheVerification = buildCacheVerification(
          minimal,
          isRecord(searchResult.wine) ? searchResult.wine : {},
          isRecord(searchResult.matchedVintage)
            ? searchResult.matchedVintage
            : null
        );
        const shouldRefreshUnverifiedCache = shouldRefreshCacheCandidate({
          cacheVerification,
          minimal,
          secondaryImageUrl,
          wine: isRecord(searchResult.wine) ? searchResult.wine : {},
        });

        if (shouldRefreshUnverifiedCache && isRecord(searchResult.wine)) {
          cacheCandidateWine = searchResult.wine;
        } else {
          return jsonResponse({
            matchedVintage: searchResult.matchedVintage,
            minimal,
            source: 'cache',
            verification: cacheVerification,
            vintages: searchResult.vintages,
            wine: searchResult.wine,
          });
        }
      }

      const extraction = await extractWineFull(
        {
          imageUrl,
          ocrText: buildLabelEvidenceText(minimal),
          secondaryImageUrl,
        },
        abortController.signal
      );
      const labelAlignedExtraction = applyVisibleLabelFacts(
        preferLabelEvidence(extraction, minimal)
      );
      const verifiedResult = await verifyAndSanitizeExtraction({
        extraction: labelAlignedExtraction,
        imageUrl,
        minimal,
        secondaryImageUrl,
        signal: abortController.signal,
      });
      const secondSearchResult = await searchWineInDb(supabase, {
        grapeVariety: verifiedResult.extraction.grape_variety,
        producer: verifiedResult.extraction.producer,
        vintageYear: verifiedResult.extraction.vintage_year,
        wineName: verifiedResult.extraction.wine_name,
      });

      if (secondSearchResult.found) {
        const cacheVerification = buildCacheVerification(
          minimal,
          isRecord(secondSearchResult.wine) ? secondSearchResult.wine : {},
          isRecord(secondSearchResult.matchedVintage)
            ? secondSearchResult.matchedVintage
            : null
        );
        const shouldRefreshUnverifiedCache = shouldRefreshCacheCandidate({
          cacheVerification,
          minimal,
          secondaryImageUrl,
          wine: isRecord(secondSearchResult.wine)
            ? secondSearchResult.wine
            : {},
        });

        if (!shouldRefreshUnverifiedCache) {
          return jsonResponse({
            matchedVintage: secondSearchResult.matchedVintage,
            minimal,
            source: 'cache',
            verification: cacheVerification,
            vintages: secondSearchResult.vintages,
            wine: secondSearchResult.wine,
          });
        }

        if (isRecord(secondSearchResult.wine)) {
          cacheCandidateWine = secondSearchResult.wine;
        }
      }

      const persisted = await persistFreshWine(
        supabase,
        verifiedResult.extraction,
        cacheCandidateWine
      );

      return jsonResponse({
        extraction: verifiedResult.extraction,
        matchedVintage: persisted.matchedVintage,
        minimal,
        source: 'fresh',
        verification: verifiedResult.verification,
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
