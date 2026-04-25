import { supabase } from '@/lib/supabase';
import type { Tables, TablesUpdate } from '@/types/database';

export type RatingRecord = Tables<'ratings'>;

export type RatingFields = Pick<
  RatingRecord,
  'drank_at' | 'notes' | 'occasion' | 'stars'
>;

type SaveRatingParams = {
  drankAt: string;
  occasion?: string;
  notes?: string;
  scanId: string;
  stars: number;
  vintageId: string;
};

const UNIQUE_VIOLATION_CODE = '23505';

function normalizeOptionalText(value?: string) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function assertValidStars(stars: number) {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error('Bitte wähle eine Bewertung zwischen 1 und 5 Sternen.');
  }
}

function normalizeError(error: { code?: string; message?: string }) {
  if (error.code === UNIQUE_VIOLATION_CODE) {
    return new Error('Bewertung existiert bereits');
  }

  return new Error(error.message ?? 'Bewertung konnte nicht gespeichert werden.');
}

function buildRatingFields({
  drankAt,
  occasion,
  notes,
  stars,
}: {
  drankAt: string;
  occasion?: string;
  notes?: string;
  stars: number;
}) {
  assertValidStars(stars);

  return {
    drank_at: drankAt,
    notes: normalizeOptionalText(notes),
    occasion: normalizeOptionalText(occasion),
    stars,
  };
}

export async function saveRating({
  drankAt,
  occasion,
  notes,
  scanId,
  stars,
  vintageId,
}: SaveRatingParams): Promise<RatingRecord> {
  const { data, error } = await supabase
    .from('ratings')
    .insert({
      ...buildRatingFields({ drankAt, occasion, notes, stars }),
      scan_id: scanId,
      vintage_id: vintageId,
    })
    .select()
    .single();

  if (error) {
    throw normalizeError(error);
  }

  return data;
}

export async function updateRating(
  ratingId: string,
  updates: Partial<RatingFields>
): Promise<RatingRecord> {
  if (typeof updates.stars === 'number') {
    assertValidStars(updates.stars);
  }

  const normalizedUpdates: TablesUpdate<'ratings'> = {
    ...updates,
  };

  if ('notes' in normalizedUpdates) {
    normalizedUpdates.notes = normalizeOptionalText(normalizedUpdates.notes ?? undefined);
  }

  if ('occasion' in normalizedUpdates) {
    normalizedUpdates.occasion = normalizeOptionalText(
      normalizedUpdates.occasion ?? undefined
    );
  }

  const { data, error } = await supabase
    .from('ratings')
    .update(normalizedUpdates)
    .eq('id', ratingId)
    .select()
    .single();

  if (error) {
    throw normalizeError(error);
  }

  return data;
}

export async function deleteRating(ratingId: string): Promise<void> {
  const { error } = await supabase.from('ratings').delete().eq('id', ratingId);

  if (error) {
    throw normalizeError(error);
  }
}

export async function getRatingForScan(
  scanId: string
): Promise<RatingRecord | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select()
    .eq('scan_id', scanId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw normalizeError(error);
  }

  return data;
}
