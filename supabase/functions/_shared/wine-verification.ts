import { createTextChatCompletion } from './ai.ts';
import {
  extractJson,
  isRecord,
  type MinimalWineExtraction,
  type WineExtraction,
} from './wine-schema.ts';

export type WineVerificationStatus =
  | 'verified'
  | 'partial'
  | 'unverified'
  | 'conflict'
  | 'needs_more_info';

export type WineEnrichmentField =
  | 'grapes'
  | 'description'
  | 'vinification'
  | 'aromas'
  | 'food_pairing'
  | 'drinking_window';

export type WineVerification = {
  conflicts: string[];
  field_status: Record<WineEnrichmentField, WineVerificationStatus>;
  model_notes: string[];
  requires_second_vision: boolean;
  safe_to_persist_enrichment: boolean;
  source_checked: boolean;
  source_status: 'found' | 'not_found' | 'timeout' | 'error';
  status: WineVerificationStatus;
  verified_data_sources: string[];
};

type VerifyWineOptions = {
  adjudication?: MinimalWineExtraction | null;
  extraction: WineExtraction;
  minimal: MinimalWineExtraction;
  signal: AbortSignal;
};

type OfficialSourceResult = {
  alcohol_percent: number | null;
  aromas: string[];
  data_sources: string[];
  description_long: string | null;
  description_short: string | null;
  drinking_window_end: number | null;
  drinking_window_start: number | null;
  evidence_snippets: string[];
  food_pairing: string | null;
  grape_varieties: string[];
  source_type: 'producer_official' | 'trusted_retailer' | 'none';
  source_url: string | null;
  status: 'found' | 'not_found' | 'conflict' | 'timeout' | 'error';
  vinification: string | null;
};

const VERIFICATION_TIMEOUT_MS = 25_000;
const OFFICIAL_SOURCE_FETCH_TIMEOUT_MS = 10_000;
const OFFICIAL_SOURCE_PARSE_TIMEOUT_MS = 15_000;
const MAX_SOURCE_TEXT_LENGTH = 18_000;

const VERIFICATION_SYSTEM_PROMPT = `Du bist Faktenpruefer fuer eine Wein-Scan-App.

AUFGABE:
Pruefe, ob eine KI-Weinanalyse durch sichtbare Label-Evidenz oder konkrete Quellen gedeckt ist.

REGELN:
1. Antworte nur als JSON.
2. Sichtbare Label-Evidenz ist fuehrend.
3. Allgemeines Weinwissen ist keine Quelle.
4. Beschreibungen, Vinifikation, Food Pairing, Aromen und Trinkfenster duerfen nur als persistierbar gelten, wenn sie aus sichtbarer Evidenz oder konkreten URLs gedeckt sind.
5. Bei Cuvées und Mischsaetzen pruefe fehlende oder falsche Rebsorten streng.
6. Wenn etwas plausibel klingt, aber nicht belegbar ist, ist es unverified.
7. Wenn sichtbare Evidenz und Analyse widersprechen, ist es conflict.

OUTPUT:
{
  "status": "verified | partial | unverified | conflict | needs_more_info",
  "safe_to_persist_enrichment": boolean,
  "requires_second_vision": boolean,
  "field_status": {
    "grapes": "verified | partial | unverified | conflict | needs_more_info",
    "description": "verified | partial | unverified | conflict | needs_more_info",
    "vinification": "verified | partial | unverified | conflict | needs_more_info",
    "aromas": "verified | partial | unverified | conflict | needs_more_info",
    "food_pairing": "verified | partial | unverified | conflict | needs_more_info",
    "drinking_window": "verified | partial | unverified | conflict | needs_more_info"
  },
  "conflicts": ["string"],
  "model_notes": ["string"],
  "verified_data_sources": ["https://..."]
}`;

const OFFICIAL_SOURCE_CANDIDATE_SYSTEM_PROMPT = `Du bist ein Recherche-Assistent fuer Wein-Fakten.

AUFGABE:
Finde Kandidaten-URLs fuer offizielle Herstellerseiten zum Wein.

REGELN:
1. Antworte nur als JSON.
2. Gib nur URLs aus, keine Fakten.
3. Herstellerseiten sind wichtiger als Shops, Magazine oder Datenbanken.
4. Wenn du keine sichere offizielle URL findest, gib [] zurueck.

OUTPUT:
{
  "urls": ["https://..."]
}`;

const OFFICIAL_SOURCE_PARSE_SYSTEM_PROMPT = `Du bist ein strenger Parser fuer Wein-Herstellerseiten.

AUFGABE:
Extrahiere Wein-Fakten ausschliesslich aus dem bereitgestellten source_text.

REGELN:
1. Antworte nur als JSON.
2. Nutze kein allgemeines Weinwissen.
3. Nutze keine Websuche.
4. Gib nur Felder aus, die im source_text belegt sind.
5. Wenn source_text nicht eindeutig zum Wein passt, status "not_found".
6. evidence_snippets muessen kurze Textauszuege aus source_text sein.

OUTPUT:
{
  "status": "found | not_found | conflict",
  "grape_varieties": ["string"],
  "alcohol_percent": number | null,
  "drinking_window_start": number | null,
  "drinking_window_end": number | null,
  "aromas": ["string"],
  "description_short": "string | null",
  "description_long": "string | null",
  "food_pairing": "string | null",
  "vinification": "string | null",
  "evidence_snippets": ["string"],
  "data_sources": ["string"]
}`;

type SourceCandidate = {
  source_type: OfficialSourceResult['source_type'];
  url: string;
};

const TRUSTED_SOURCE_HINTS: {
  producerIncludes: string[];
  source_type: OfficialSourceResult['source_type'];
  url: string;
  wineIncludes: string[];
}[] = [
  {
    producerIncludes: ['kurtatsch', 'cortaccia'],
    source_type: 'producer_official',
    url: 'https://www.kellerei-kurtatsch.it/en/wines/amos-5/',
    wineIncludes: ['amos'],
  },
];

const ALL_FIELDS: WineEnrichmentField[] = [
  'grapes',
  'description',
  'vinification',
  'aromas',
  'food_pairing',
  'drinking_window',
];

function status(value: unknown): WineVerificationStatus {
  if (
    value === 'verified' ||
    value === 'partial' ||
    value === 'unverified' ||
    value === 'conflict' ||
    value === 'needs_more_info'
  ) {
    return value;
  }

  return 'unverified';
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function stringList(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function httpUrls(value: unknown) {
  return stringList(value, 12).filter((item) => {
    try {
      const url = new URL(item);

      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  });
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sourceStatus(
  value: unknown
): WineVerification['source_status'] {
  if (
    value === 'found' ||
    value === 'not_found' ||
    value === 'timeout' ||
    value === 'error'
  ) {
    return value;
  }

  return 'not_found';
}

function officialSourceStatus(value: unknown): OfficialSourceResult['status'] {
  if (
    value === 'found' ||
    value === 'conflict' ||
    value === 'timeout' ||
    value === 'error'
  ) {
    return value;
  }

  return 'not_found';
}

function sourceType(value: unknown): OfficialSourceResult['source_type'] {
  if (value === 'producer_official' || value === 'trusted_retailer') {
    return value;
  }

  return 'none';
}

function uniqueList(values: string[], maxItems = 12) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = value.trim();
    const key = normalizeText(cleaned);

    if (!cleaned || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);

    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

function mergeTextValue(
  preferred: string | null,
  fallback: string | null
) {
  return preferred && preferred.trim() ? preferred : fallback;
}

function grapeNamesFromText(value: string) {
  return value
    .split(/[,;/]+|\s+-\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^(variety|rebsorte)$/i.test(item))
    .slice(0, 12);
}

function firstMatch(text: string, pattern: RegExp) {
  return pattern.exec(text)?.[1]?.trim() ?? null;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&shy;/g, '')
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16))
    );
}

function htmlToReadableText(html: string) {
  const withoutNoisyTags = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  const withLineBreaks = withoutNoisyTags
    .replace(/<(br|p|div|section|article|header|footer|li|tr|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|tr|h[1-6])>/gi, '\n');
  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, ' ');

  return decodeHtmlEntities(withoutTags)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_SOURCE_TEXT_LENGTH);
}

function hasIdentityMatch(
  extraction: WineExtraction,
  sourceText: string,
  candidate: SourceCandidate
) {
  if (candidate.source_type === 'producer_official') {
    return true;
  }

  const normalizedSourceText = normalizeText(sourceText);
  const producerTokens = normalizeText(extraction.producer)
    .split(' ')
    .filter((token) => token.length >= 4);
  const wineTokens = normalizeText(extraction.wine_name)
    .split(' ')
    .filter((token) => token.length >= 3);
  const hasProducer = producerTokens.some((token) =>
    normalizedSourceText.includes(token)
  );
  const hasWine = wineTokens.some((token) =>
    normalizedSourceText.includes(token)
  );

  return hasProducer && hasWine;
}

function getTrustedSourceCandidates(extraction: WineExtraction) {
  const haystack = normalizeText(
    `${extraction.producer} ${extraction.wine_name}`
  );

  return TRUSTED_SOURCE_HINTS.filter((hint) => {
    const producerMatches = hint.producerIncludes.some((value) =>
      haystack.includes(normalizeText(value))
    );
    const wineMatches = hint.wineIncludes.some((value) =>
      haystack.includes(normalizeText(value))
    );

    return producerMatches && wineMatches;
  }).map<SourceCandidate>((hint) => ({
    source_type: hint.source_type,
    url: hint.url,
  }));
}

function parseCandidateUrls(value: unknown): string[] {
  const raw = isRecord(value) ? value.urls : value;

  return httpUrls(raw).slice(0, 4);
}

async function findOfficialSourceCandidates(
  extraction: WineExtraction,
  signal: AbortSignal
) {
  const trustedCandidates = getTrustedSourceCandidates(extraction);

  if (trustedCandidates.length > 0) {
    return trustedCandidates;
  }

  const timeout = withTimeout(signal, OFFICIAL_SOURCE_PARSE_TIMEOUT_MS);

  try {
    const responseText = await createTextChatCompletion({
      maxTokens: 600,
      purpose: 'source',
      signal: timeout.signal,
      system: OFFICIAL_SOURCE_CANDIDATE_SYSTEM_PROMPT,
      userText: JSON.stringify(
        {
          producer: extraction.producer,
          vintage_year:
            extraction.vintage_year ?? extraction.estimated_vintage_year,
          wine_name: extraction.wine_name,
        },
        null,
        2
      ),
    });

    return parseCandidateUrls(
      parseModelJson(responseText, 'Quellen-Kandidaten')
    ).map<SourceCandidate>((url) => ({
      source_type: 'producer_official',
      url,
    }));
  } finally {
    timeout.clear();
  }
}

async function fetchSourceText(candidate: SourceCandidate, signal: AbortSignal) {
  const timeout = withTimeout(signal, OFFICIAL_SOURCE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(candidate.url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'User-Agent':
          'WineScannerBot/1.0 (+https://franco-consulting.com)',
      },
      redirect: 'follow',
      signal: timeout.signal,
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (
      contentType &&
      !contentType.includes('text/html') &&
      !contentType.includes('text/plain') &&
      !contentType.includes('application/xhtml')
    ) {
      return null;
    }

    const html = await response.text();
    const text = htmlToReadableText(html);

    if (text.length < 100) {
      return null;
    }

    return {
      finalUrl: response.url || candidate.url,
      text,
    };
  } finally {
    timeout.clear();
  }
}

function extractOfficialFactsFromText(
  sourceText: string,
  sourceUrl: string,
  candidate: SourceCandidate
): OfficialSourceResult {
  const varietyText = firstMatch(
    sourceText,
    /(?:^|\n)\s*(?:Variety|Rebsorte)\s+([^\n]+)/i
  );
  const vinification = firstMatch(
    sourceText,
    /(?:^|\n)\s*(?:Vinification|Vinifizierung)\s+([\s\S]{0,650}?)(?:\n\s*(?:Alcohol|Alkohol|Total acidity|Gesamtsaeure|Gesamtsäure|Residual sugar|Restzucker|Yield|Hektarertrag|Optimum maturity|Optimale))/i
  );
  const alcoholText = firstMatch(
    sourceText,
    /(?:^|\n)\s*(?:Alcohol|Alkohol)\s+([0-9]+(?:[,.][0-9]+)?)/i
  );
  const maturity = /(?:^|\n)\s*(?:Optimum maturity|Optimale\s+Trinkreife)\s+(\d+)\s*-\s*(\d+)/i.exec(
    sourceText
  );
  const about = firstMatch(
    sourceText,
    /(?:^|\n)\s*(?:About this wine|Über diesen Wein|Ueber diesen Wein)\s+([\s\S]{0,1200}?)(?:\n\s*(?:Read more|Mehr lesen|Data sheet|Datenblatt|Characteristics|Eigenschaften))/i
  );
  const grapes = varietyText ? grapeNamesFromText(varietyText) : [];
  const alcohol = alcoholText
    ? Number(alcoholText.replace(',', '.'))
    : null;
  const evidenceSnippets = uniqueList(
    [
      varietyText ? `Variety ${varietyText}` : '',
      vinification ? `Vinification ${vinification}` : '',
      alcoholText ? `Alcohol ${alcoholText}` : '',
      maturity ? `Optimum maturity ${maturity[1]}-${maturity[2]} years` : '',
    ],
    6
  );
  const hasFacts =
    grapes.length > 0 ||
    Boolean(vinification) ||
    alcohol !== null ||
    Boolean(maturity);

  return {
    alcohol_percent: alcohol,
    aromas: [],
    data_sources: hasFacts ? [sourceUrl] : [],
    description_long: about,
    description_short: about
      ? about.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
      : null,
    drinking_window_end: maturity ? Number(maturity[2]) : null,
    drinking_window_start: maturity ? Number(maturity[1]) : null,
    evidence_snippets: evidenceSnippets,
    food_pairing: null,
    grape_varieties: grapes,
    source_type: hasFacts ? candidate.source_type : 'none',
    source_url: hasFacts ? sourceUrl : null,
    status: hasFacts ? 'found' : 'not_found',
    vinification,
  };
}

function mergeOfficialSources(
  primary: OfficialSourceResult,
  secondary: OfficialSourceResult
): OfficialSourceResult {
  const mergedSources = uniqueList(
    [...primary.data_sources, ...secondary.data_sources],
    12
  );
  const mergedGrapes = uniqueList(
    [...primary.grape_varieties, ...secondary.grape_varieties],
    12
  );
  const mergedEvidenceSnippets = uniqueList(
    [...primary.evidence_snippets, ...secondary.evidence_snippets],
    8
  );
  const hasMergedFacts =
    mergedGrapes.length > 0 ||
    Boolean(primary.vinification ?? secondary.vinification) ||
    Boolean(primary.description_long ?? secondary.description_long) ||
    mergedEvidenceSnippets.length > 0;

  return {
    alcohol_percent: primary.alcohol_percent ?? secondary.alcohol_percent,
    aromas: primary.aromas.length > 0 ? primary.aromas : secondary.aromas,
    data_sources: mergedSources,
    description_long: mergeTextValue(
      primary.description_long,
      secondary.description_long
    ),
    description_short: mergeTextValue(
      primary.description_short,
      secondary.description_short
    ),
    drinking_window_end:
      primary.drinking_window_end ?? secondary.drinking_window_end,
    drinking_window_start:
      primary.drinking_window_start ?? secondary.drinking_window_start,
    evidence_snippets: mergedEvidenceSnippets,
    food_pairing: mergeTextValue(primary.food_pairing, secondary.food_pairing),
    grape_varieties: mergedGrapes,
    source_type:
      primary.source_type !== 'none' ? primary.source_type : secondary.source_type,
    source_url: primary.source_url ?? secondary.source_url,
    status:
      mergedSources.length > 0 && hasMergedFacts
        ? 'found'
        : primary.status === 'conflict' || secondary.status === 'conflict'
          ? 'conflict'
          : 'not_found',
    vinification: mergeTextValue(primary.vinification, secondary.vinification),
  };
}

function fieldStatus(value: unknown): WineVerification['field_status'] {
  const rawFieldStatus = isRecord(value) ? value : {};

  return ALL_FIELDS.reduce((result, field) => {
    result[field] = status(rawFieldStatus[field]);

    return result;
  }, {} as WineVerification['field_status']);
}

function parseVerification(value: unknown): WineVerification {
  const raw = isRecord(value) ? value : {};

  return {
    conflicts: stringList(raw.conflicts, 8),
    field_status: fieldStatus(raw.field_status),
    model_notes: stringList(raw.model_notes, 8),
    requires_second_vision: raw.requires_second_vision === true,
    safe_to_persist_enrichment: raw.safe_to_persist_enrichment === true,
    source_checked: raw.source_checked === true,
    source_status: sourceStatus(raw.source_status),
    status: status(raw.status),
    verified_data_sources: httpUrls(raw.verified_data_sources),
  };
}

function parseOfficialSource(value: unknown): OfficialSourceResult {
  const raw = isRecord(value) ? value : {};
  const dataSources = httpUrls(raw.data_sources);
  const parsedStatus = officialSourceStatus(raw.status);

  return {
    alcohol_percent: numberOrNull(raw.alcohol_percent),
    aromas: stringList(raw.aromas, 8),
    data_sources: dataSources,
    description_long: stringOrNull(raw.description_long),
    description_short: stringOrNull(raw.description_short),
    drinking_window_end: numberOrNull(raw.drinking_window_end),
    drinking_window_start: numberOrNull(raw.drinking_window_start),
    evidence_snippets: stringList(raw.evidence_snippets, 8),
    food_pairing: stringOrNull(raw.food_pairing),
    grape_varieties: stringList(raw.grape_varieties, 12),
    source_url: stringOrNull(raw.source_url),
    source_type: dataSources.length > 0 ? sourceType(raw.source_type) : 'none',
    status: parsedStatus,
    vinification: stringOrNull(raw.vinification),
  };
}

function parseModelJson(responseText: string, label: string) {
  try {
    return extractJson(responseText);
  } catch (error) {
    const preview = responseText.trim().slice(0, 300);
    const reason = error instanceof Error ? error.message : 'Unbekannter Fehler';

    throw new Error(`${label}: ${reason}. Antwort: ${preview}`);
  }
}

function withTimeout(signal: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();

  signal.addEventListener('abort', abort, { once: true });

  return {
    clear() {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    },
    signal: controller.signal,
  };
}

export function buildBasicVerification(
  statusValue: WineVerificationStatus,
  note: string
): WineVerification {
  return {
    conflicts: [],
    field_status: ALL_FIELDS.reduce((result, field) => {
      result[field] = statusValue;

      return result;
    }, {} as WineVerification['field_status']),
    model_notes: [note],
    requires_second_vision:
      statusValue === 'conflict' || statusValue === 'needs_more_info',
    safe_to_persist_enrichment: statusValue === 'verified',
    source_checked: false,
    source_status: 'not_found',
    status: statusValue,
    verified_data_sources: [],
  };
}

export function buildCacheVerification(
  minimal: MinimalWineExtraction,
  wine: Record<string, unknown>,
  vintage: Record<string, unknown> | null
): WineVerification {
  const sources = httpUrls(vintage?.data_sources);
  const hasGrapes =
    Boolean(minimal.grape_variety || minimal.grape_varieties.length > 0) &&
    typeof wine.grape_variety === 'string' &&
    wine.grape_variety.trim().length > 0;
  const statusValue: WineVerificationStatus =
    sources.length > 0 ? 'verified' : hasGrapes ? 'partial' : 'unverified';

  return {
    ...buildBasicVerification(
      statusValue,
      sources.length > 0
        ? 'Cache-Daten haben konkrete Quellen.'
        : 'Cache-Daten wurden nicht mit einer Quelle belegt.'
    ),
    field_status: {
      aromas: statusValue,
      description: statusValue,
      drinking_window: statusValue,
      food_pairing: statusValue,
      grapes: hasGrapes ? 'partial' : 'unverified',
      vinification: statusValue,
    },
    safe_to_persist_enrichment: sources.length > 0,
    verified_data_sources: sources,
  };
}

export function shouldRunAdjudicator(
  minimal: MinimalWineExtraction,
  extraction: WineExtraction,
  verification: WineVerification
) {
  const visibleText = minimal.visible_text_lines.join(' ').toLowerCase();
  const extractedGrapes = [
    extraction.grape_variety ?? '',
    ...extraction.grape_varieties,
  ]
    .join(' ')
    .toLowerCase();
  const looksLikeBlend =
    visibleText.includes('cuv') ||
    visibleText.includes('blend') ||
    visibleText.includes('verschnitt') ||
    extractedGrapes.includes(',') ||
    extraction.grape_varieties.length > 1;

  return (
    verification.requires_second_vision ||
    verification.status === 'conflict' ||
    verification.field_status.grapes === 'conflict' ||
    minimal.photo_quality !== 'good' ||
    looksLikeBlend ||
    (minimal.confidence.overall >= 0.6 && minimal.confidence.overall <= 0.88)
  );
}

export async function verifyWineExtraction({
  adjudication,
  extraction,
  minimal,
  signal,
}: VerifyWineOptions) {
  const timeout = withTimeout(signal, VERIFICATION_TIMEOUT_MS);

  try {
    const responseText = await createTextChatCompletion({
      maxTokens: 1800,
      purpose: 'validation',
      signal: timeout.signal,
      system: VERIFICATION_SYSTEM_PROMPT,
      userText: JSON.stringify(
        {
          adjudication,
          full_extraction: extraction,
          minimal_label_evidence: minimal,
        },
        null,
        2
      ),
    });

    return parseVerification(
      parseModelJson(responseText, 'Faktenpruefung')
    );
  } finally {
    timeout.clear();
  }
}

export function shouldRunOfficialSourceCheck(
  extraction: WineExtraction,
  verification: WineVerification,
  minimal?: MinimalWineExtraction
) {
  const visibleText = minimal?.visible_text_lines.join(' ').toLowerCase() ?? '';
  const extractedGrapes = [
    extraction.grape_variety ?? '',
    ...extraction.grape_varieties,
  ]
    .join(' ')
    .toLowerCase();
  const looksLikeBlend =
    visibleText.includes('cuv') ||
    visibleText.includes('blend') ||
    visibleText.includes('verschnitt') ||
    extractedGrapes.includes(',') ||
    extraction.grape_varieties.length > 1;
  const missingGrapes =
    !extraction.grape_variety?.trim() && extraction.grape_varieties.length === 0;
  const riskySourceFields: WineEnrichmentField[] = [
    'grapes',
    'description',
    'vinification',
  ];
  const hasUnverifiedCoreField = riskySourceFields.some((field) => {
    const fieldStatus = verification.field_status[field];

    return (
      fieldStatus === 'partial' ||
      fieldStatus === 'unverified' ||
      fieldStatus === 'conflict' ||
      fieldStatus === 'needs_more_info'
    );
  });

  return (
    Deno.env.get('VANTERO_ENABLE_SOURCE_CHECK') === 'true' &&
    Boolean(extraction.producer.trim()) &&
    Boolean(extraction.wine_name.trim()) &&
    (extraction.confidence.overall >= 0.65 ||
      looksLikeBlend ||
      missingGrapes ||
      hasUnverifiedCoreField ||
      !verification.safe_to_persist_enrichment)
  );
}

async function parseOfficialSourceFromText({
  candidate,
  extraction,
  signal,
  sourceText,
  sourceUrl,
}: {
  candidate: SourceCandidate;
  extraction: WineExtraction;
  signal: AbortSignal;
  sourceText: string;
  sourceUrl: string;
}) {
  const deterministicSource = extractOfficialFactsFromText(
    sourceText,
    sourceUrl,
    candidate
  );
  const timeout = withTimeout(signal, OFFICIAL_SOURCE_PARSE_TIMEOUT_MS);

  try {
    const responseText = await createTextChatCompletion({
      maxTokens: 1800,
      purpose: 'source',
      signal: timeout.signal,
      system: OFFICIAL_SOURCE_PARSE_SYSTEM_PROMPT,
      userText: JSON.stringify(
        {
          expected: {
            producer: extraction.producer,
            vintage_year:
              extraction.vintage_year ?? extraction.estimated_vintage_year,
            wine_name: extraction.wine_name,
          },
          source_text: sourceText,
          source_url: sourceUrl,
        },
        null,
        2
      ),
    });
    const modelSource = parseOfficialSource(
      parseModelJson(responseText, 'Herstellerseiten-Parser')
    );
    const source = mergeOfficialSources(modelSource, deterministicSource);

    return {
      ...source,
      data_sources: source.data_sources.length > 0
        ? source.data_sources
        : [sourceUrl],
      source_type:
        source.source_type !== 'none' ? source.source_type : candidate.source_type,
      source_url: source.source_url ?? sourceUrl,
    };
  } catch {
    return deterministicSource;
  } finally {
    timeout.clear();
  }
}

export async function verifyOfficialWineSource(
  extraction: WineExtraction,
  signal: AbortSignal
) {
  const sourceCandidates = await findOfficialSourceCandidates(
    extraction,
    signal
  );

  if (sourceCandidates.length === 0) {
    return null;
  }

  for (const candidate of sourceCandidates) {
    try {
      const fetchedSource = await fetchSourceText(candidate, signal);

      if (!fetchedSource) {
        continue;
      }

      if (!hasIdentityMatch(extraction, fetchedSource.text, candidate)) {
        continue;
      }

      const source = await parseOfficialSourceFromText({
        candidate,
        extraction,
        signal,
        sourceText: fetchedSource.text,
        sourceUrl: fetchedSource.finalUrl,
      });

      if (source.status === 'found' && source.data_sources.length > 0) {
        return source;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          alcohol_percent: null,
          aromas: [],
          data_sources: [],
          description_long: null,
          description_short: null,
          drinking_window_end: null,
          drinking_window_start: null,
          evidence_snippets: [],
          food_pairing: null,
          grape_varieties: [],
          source_type: 'none',
          source_url: null,
          status: 'timeout',
          vinification: null,
        };
      }
    }
  }

  return null;
}

export function mergeOfficialSource(
  extraction: WineExtraction,
  source: OfficialSourceResult
): WineExtraction {
  const grapeVariety =
    source.grape_varieties.length > 0
      ? source.grape_varieties.join(', ')
      : extraction.grape_variety;

  return {
    ...extraction,
    alcohol_percent: source.alcohol_percent ?? extraction.alcohol_percent,
    aromas: source.aromas.length > 0 ? source.aromas : extraction.aromas,
    data_sources: Array.from(
      new Set([...extraction.data_sources, ...source.data_sources])
    ),
    description_long: source.description_long ?? extraction.description_long,
    description_short: source.description_short ?? extraction.description_short,
    drinking_window_end:
      source.drinking_window_end ?? extraction.drinking_window_end,
    drinking_window_start:
      source.drinking_window_start ?? extraction.drinking_window_start,
    food_pairing: source.food_pairing ?? extraction.food_pairing,
    grape_variety: grapeVariety,
    grape_varieties:
      source.grape_varieties.length > 0
        ? source.grape_varieties
        : extraction.grape_varieties,
    vinification: source.vinification ?? extraction.vinification,
  };
}

function canKeepField(
  verification: WineVerification,
  field: WineEnrichmentField,
  hasTrustedSource: boolean
) {
  const fieldStatus = verification.field_status[field];

  return (
    hasTrustedSource &&
    verification.safe_to_persist_enrichment &&
    (fieldStatus === 'verified' || fieldStatus === 'partial')
  );
}

export function sanitizeExtractionForVerification(
  extraction: WineExtraction,
  verification: WineVerification
): WineExtraction {
  const sources = Array.from(
    new Set([...extraction.data_sources, ...verification.verified_data_sources])
  );
  const hasTrustedSource = sources.length > 0;
  const descriptionAllowed = canKeepField(
    verification,
    'description',
    hasTrustedSource
  );
  const vinificationAllowed = canKeepField(
    verification,
    'vinification',
    hasTrustedSource
  );
  const aromasAllowed = canKeepField(verification, 'aromas', hasTrustedSource);
  const foodPairingAllowed = canKeepField(
    verification,
    'food_pairing',
    hasTrustedSource
  );
  const drinkingWindowAllowed = canKeepField(
    verification,
    'drinking_window',
    hasTrustedSource
  );
  const notes = [
    extraction.notes,
    verification.status === 'verified'
      ? ''
      : 'Anreicherungsdaten wurden nicht sicher verifiziert.',
    ...verification.conflicts,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    ...extraction,
    aromas: aromasAllowed ? extraction.aromas : [],
    data_sources: sources,
    description_long: descriptionAllowed ? extraction.description_long : null,
    description_short: descriptionAllowed ? extraction.description_short : null,
    drinking_window_end: drinkingWindowAllowed
      ? extraction.drinking_window_end
      : null,
    drinking_window_start: drinkingWindowAllowed
      ? extraction.drinking_window_start
      : null,
    food_pairing: foodPairingAllowed ? extraction.food_pairing : null,
    notes,
    price_max_eur: drinkingWindowAllowed ? extraction.price_max_eur : null,
    price_min_eur: drinkingWindowAllowed ? extraction.price_min_eur : null,
    serving_temperature: foodPairingAllowed
      ? extraction.serving_temperature
      : null,
    verification,
    vinification: vinificationAllowed ? extraction.vinification : null,
  };
}
