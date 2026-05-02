export type WineColor = 'weiss' | 'rot' | 'rose' | 'schaum' | 'suess';

export type TasteDryness = 'trocken' | 'halbtrocken' | 'lieblich' | 'suess';

export type Confidence = {
  producer: number;
  wine_name: number;
  vintage_year: number;
  overall: number;
};

export type MinimalWineExtraction = {
  estimated_vintage_year: number | null;
  estimated_vintage_year_reason: string | null;
  grape_variety: string | null;
  needs_more_info_reason: string | null;
  photo_quality: 'good' | 'ok' | 'poor';
  producer: string;
  visible_text_lines: string[];
  wine_name: string;
  vintage_year: number | null;
  confidence: Confidence;
};

export type WineExtraction = MinimalWineExtraction & {
  region: string | null;
  country: string | null;
  appellation: string | null;
  grape_variety: string | null;
  wine_color: WineColor | null;
  taste_dryness: TasteDryness | null;
  alcohol_percent: number | null;
  drinking_window_start: number | null;
  drinking_window_end: number | null;
  price_min_eur: number | null;
  price_max_eur: number | null;
  aromas: string[];
  description_short: string | null;
  description_long: string | null;
  food_pairing: string | null;
  serving_temperature: string | null;
  vinification: string | null;
  data_sources: string[];
  notes: string;
};

export type ExtractWineRequest = {
  imageUrl: string;
  ocrText?: string;
  secondaryImageUrl?: string;
};

const WINE_COLORS = new Set<WineColor>([
  'weiss',
  'rot',
  'rose',
  'schaum',
  'suess',
]);

const TASTE_DRYNESS = new Set<TasteDryness>([
  'trocken',
  'halbtrocken',
  'lieblich',
  'suess',
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requiredString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function stringList(value: unknown, maxItems = 8): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function photoQuality(value: unknown): MinimalWineExtraction['photo_quality'] {
  if (value === 'good' || value === 'ok' || value === 'poor') {
    return value;
  }

  return 'ok';
}

function parseHttpUrl(value: unknown, label: string): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`Ungültiger Request: ${label} ist keine URL.`);
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`Ungültiger Request: ${label} ist keine URL.`);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`Ungültiger Request: ${label} muss eine HTTP-URL sein.`);
  }

  return value;
}

function confidence(value: unknown): number {
  const numberValue = numberOrNull(value);

  if (numberValue === null) {
    return 0;
  }

  return Math.max(0, Math.min(1, numberValue));
}

function integerYearOrNull(value: unknown): number | null {
  const numberValue = numberOrNull(value);

  if (numberValue === null) {
    return null;
  }

  const roundedValue = Math.round(numberValue);

  return roundedValue >= 1800 && roundedValue <= 2100 ? roundedValue : null;
}

function wineColorOrNull(value: unknown): WineColor | null {
  return typeof value === 'string' && WINE_COLORS.has(value as WineColor)
    ? (value as WineColor)
    : null;
}

function tasteDrynessOrNull(value: unknown): TasteDryness | null {
  return typeof value === 'string' && TASTE_DRYNESS.has(value as TasteDryness)
    ? (value as TasteDryness)
    : null;
}

function parseConfidence(value: unknown): Confidence {
  const rawConfidence = isRecord(value) ? value : {};

  return {
    producer: confidence(rawConfidence.producer),
    wine_name: confidence(rawConfidence.wine_name),
    vintage_year: confidence(rawConfidence.vintage_year),
    overall: confidence(rawConfidence.overall),
  };
}

export function extractJson(text: string) {
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

export function validateExtractWineRequest(value: unknown): ExtractWineRequest {
  if (!isRecord(value) || typeof value.imageUrl !== 'string') {
    throw new Error('Ungültiger Request: imageUrl fehlt.');
  }

  const imageUrl = parseHttpUrl(value.imageUrl, 'imageUrl');
  const secondaryImageUrl = parseHttpUrl(
    value.secondaryImageUrl,
    'secondaryImageUrl'
  );

  return {
    imageUrl: imageUrl ?? '',
    ocrText: typeof value.ocrText === 'string' ? value.ocrText : undefined,
    secondaryImageUrl,
  };
}

export function validateMinimalWineExtraction(
  value: unknown
): MinimalWineExtraction {
  if (!isRecord(value)) {
    throw new Error('Vantero-Antwort ist kein Objekt.');
  }

  const vintageYear = integerYearOrNull(value.vintage_year);
  const parsedConfidence = parseConfidence(value.confidence);

  return {
    estimated_vintage_year: integerYearOrNull(value.estimated_vintage_year),
    estimated_vintage_year_reason: stringOrNull(
      value.estimated_vintage_year_reason
    ),
    grape_variety: stringOrNull(value.grape_variety),
    needs_more_info_reason: stringOrNull(value.needs_more_info_reason),
    photo_quality: photoQuality(value.photo_quality),
    producer: requiredString(value.producer, ''),
    visible_text_lines: stringList(value.visible_text_lines, 16),
    wine_name: requiredString(value.wine_name, ''),
    vintage_year: vintageYear,
    confidence: {
      ...parsedConfidence,
      vintage_year: vintageYear === null ? 0 : parsedConfidence.vintage_year,
    },
  };
}

export function validateWineExtraction(value: unknown): WineExtraction {
  if (!isRecord(value)) {
    throw new Error('Vantero-Antwort ist kein Objekt.');
  }

  const minimal = validateMinimalWineExtraction(value);

  return {
    ...minimal,
    region: stringOrNull(value.region),
    country: stringOrNull(value.country),
    appellation: stringOrNull(value.appellation),
    grape_variety: stringOrNull(value.grape_variety),
    wine_color: wineColorOrNull(value.wine_color),
    taste_dryness: tasteDrynessOrNull(value.taste_dryness),
    alcohol_percent: numberOrNull(value.alcohol_percent),
    drinking_window_start: integerYearOrNull(value.drinking_window_start),
    drinking_window_end: integerYearOrNull(value.drinking_window_end),
    price_min_eur: numberOrNull(value.price_min_eur),
    price_max_eur: numberOrNull(value.price_max_eur),
    aromas: stringList(value.aromas),
    description_short: stringOrNull(value.description_short),
    description_long: stringOrNull(value.description_long),
    food_pairing: stringOrNull(value.food_pairing),
    serving_temperature: stringOrNull(value.serving_temperature),
    vinification: stringOrNull(value.vinification),
    data_sources: stringList(value.data_sources, 12),
    notes: requiredString(value.notes, ''),
  };
}
