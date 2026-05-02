import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  createUserClient,
  errorResponse,
  getBearerToken,
  handleCors,
  isRecord,
  jsonResponse,
  requirePost,
  requireUser,
} from '../_shared/http.ts';

type SaveSource = 'cache' | 'draft' | 'fresh' | 'manual';

const WINE_COLORS = new Set(['weiss', 'rot', 'rose', 'schaum', 'suess']);
const TASTE_DRYNESS = new Set(['trocken', 'halbtrocken', 'lieblich', 'suess']);

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function validateYear(value: unknown, required = true) {
  const year = numberOrNull(value);
  const maxYear = new Date().getFullYear() + 1;

  if (year === null && !required) {
    return null;
  }

  if (year === null || !Number.isInteger(year) || year < 1900 || year > maxYear) {
    throw new Error('Bitte wähle einen gültigen Jahrgang.');
  }

  return year;
}

function validateSource(value: unknown): SaveSource {
  if (
    value === 'cache' ||
    value === 'draft' ||
    value === 'fresh' ||
    value === 'manual'
  ) {
    return value;
  }

  throw new Error('Ungültige Quelle.');
}

function validateWineData(value: unknown) {
  if (!isRecord(value)) {
    throw new Error('Weindaten fehlen.');
  }

  const wineColor = stringOrNull(value.wine_color);
  const tasteDryness = stringOrNull(value.taste_dryness);

  if (wineColor && !WINE_COLORS.has(wineColor)) {
    throw new Error('Ungültige Weinfarbe.');
  }

  if (tasteDryness && !TASTE_DRYNESS.has(tasteDryness)) {
    throw new Error('Ungültiger Geschmack.');
  }

  return {
    alcohol_percent: numberOrNull(value.alcohol_percent),
    appellation: stringOrNull(value.appellation),
    country: stringOrNull(value.country),
    grape_variety: stringOrNull(value.grape_variety),
    producer: stringOrNull(value.producer),
    region: stringOrNull(value.region),
    taste_dryness: tasteDryness,
    wine_color: wineColor,
    wine_name: stringOrNull(value.wine_name),
  };
}

function validateVintageData(value: unknown, selectedVintageYear: number) {
  const record = isRecord(value) ? value : {};

  return {
    ai_confidence: numberOrNull(record.ai_confidence),
    alcohol_percent: numberOrNull(record.alcohol_percent),
    aromas: stringArray(record.aromas, 8),
    data_sources: stringArray(record.data_sources, 12),
    description_long: stringOrNull(record.description_long),
    description_short: stringOrNull(record.description_short),
    drinking_window_end: numberOrNull(record.drinking_window_end),
    drinking_window_start: numberOrNull(record.drinking_window_start),
    food_pairing: stringOrNull(record.food_pairing),
    price_max_eur: numberOrNull(record.price_max_eur),
    price_min_eur: numberOrNull(record.price_min_eur),
    serving_temperature: stringOrNull(record.serving_temperature),
    vinification: stringOrNull(record.vinification),
    vintage_year: selectedVintageYear,
  };
}

function validateCorrections(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((correction) => ({
      ai_value: String(correction.ai_value ?? ''),
      field: String(correction.field ?? '').trim(),
      user_value: String(correction.user_value ?? ''),
    }))
    .filter(
      (correction) =>
        correction.field &&
        correction.ai_value !== correction.user_value
    )
    .slice(0, 20);
}

function validateSaveScanRequest(value: unknown) {
  if (!isRecord(value)) {
    throw new Error('Ungültiger Request.');
  }

  const source = validateSource(value.source);
  const selectedVintageYear = validateYear(
    value.selectedVintageYear,
    source !== 'draft'
  );
  const storagePath = stringOrNull(value.storagePath);

  if (!storagePath) {
    throw new Error('storagePath fehlt.');
  }

  const wineData = validateWineData(value.wineData);

  if (source === 'manual' && (!wineData.producer || !wineData.wine_name)) {
    throw new Error('Weingut und Weinname sind Pflichtfelder.');
  }

  if (source === 'cache' && !stringOrNull(value.wineId)) {
    throw new Error('wineId fehlt.');
  }

  return {
    analysisVintageId: stringOrNull(value.analysisVintageId),
    bottleStoragePath: stringOrNull(value.bottleStoragePath),
    corrections: validateCorrections(value.corrections),
    existingScanId: stringOrNull(value.existingScanId),
    imageUrl: stringOrNull(value.imageUrl),
    selectedVintageYear,
    source,
    storagePath,
    vintageData:
      selectedVintageYear === null
        ? {}
        : validateVintageData(value.vintageData, selectedVintageYear),
    wineData,
    wineId: stringOrNull(value.wineId),
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

    const token = getBearerToken(req);

    if (!token) {
      throw jsonResponse({ error: 'Nicht eingeloggt.' }, 401);
    }

    const payload = validateSaveScanRequest(await req.json());
    const supabase = createUserClient(token);
    const { data, error } = await supabase.rpc('save_scan_atomic', {
      payload,
    });

    if (error) {
      throw error;
    }

    return jsonResponse(data);
  } catch (error) {
    return errorResponse(error);
  }
});
