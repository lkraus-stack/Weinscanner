import * as Sentry from '@sentry/react-native';

export type AdoptionFeature = 'compliance' | 'discover' | 'scan';

export type AdoptionEventName =
  | 'age_gate_failed'
  | 'age_gate_passed'
  | 'age_gate_shown'
  | 'ai_consent_accepted'
  | 'ai_consent_declined'
  | 'ai_consent_shown'
  | 'discover_search_executed'
  | 'discover_tab_opened'
  | 'restaurant_ai_detail_viewed'
  | 'restaurant_ai_recommendation_requested'
  | 'restaurant_detail_viewed'
  | 'restaurant_marker_tapped'
  | 'restaurant_rated'
  | 'restaurant_saved'
  | 'wine_scan_completed'
  | 'wine_scan_started';

type AdoptionTagKey = 'city' | 'entry' | 'occasion' | 'result_source';
type AdoptionTagValue = boolean | number | string | null | undefined;

type AdoptionEventOptions = {
  feature: AdoptionFeature;
  tags?: Partial<Record<AdoptionTagKey, AdoptionTagValue>>;
};

const MAX_TAG_LENGTH = 64;
const TAG_KEYS = new Set<AdoptionTagKey>([
  'city',
  'entry',
  'occasion',
  'result_source',
]);

export function sanitizeCityTag(city: string | null | undefined) {
  const normalizedCity = city?.trim().replace(/\s+/g, ' ');

  return normalizedCity ? normalizedCity.slice(0, MAX_TAG_LENGTH) : undefined;
}

function sanitizeTagValue(value: AdoptionTagValue) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().replace(/\s+/g, ' ');

    return normalizedValue ? normalizedValue.slice(0, MAX_TAG_LENGTH) : undefined;
  }

  return String(value);
}

function sanitizeTags(tags: AdoptionEventOptions['tags']) {
  const safeTags: Record<string, string> = {};

  if (!tags) {
    return safeTags;
  }

  for (const [key, value] of Object.entries(tags)) {
    if (!TAG_KEYS.has(key as AdoptionTagKey)) {
      continue;
    }

    const safeValue = sanitizeTagValue(value);

    if (safeValue) {
      safeTags[key] = safeValue;
    }
  }

  return safeTags;
}

export function trackAdoptionEvent(
  name: AdoptionEventName,
  { feature, tags }: AdoptionEventOptions
) {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  try {
    Sentry.captureEvent({
      level: 'info',
      message: name,
      tags: {
        event: name,
        feature,
        ...sanitizeTags(tags),
      },
    });
  } catch {
    // Analytics must never block the user flow.
  }
}
